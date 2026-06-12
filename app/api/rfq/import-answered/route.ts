import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SUPPORTED_CURRENCIES, type Currency } from "@/lib/currency";
import { isValidImpa } from "@/lib/rfq-parse/quote-unify";

const MAX_SUPPLIER_FILES = 10;
const MAX_ITEMS = 300;

// UUID format kontrolü
function isUuid(val: unknown): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

function asTrimmed(val: unknown, max: number): string | null {
  if (typeof val !== "string") return null;
  const t = val.trim();
  return t ? t.slice(0, max) : null;
}

function isNonNegativeNumber(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val) && val >= 0;
}

type NormalizedItem = {
  temp_id: string;
  order_no: number;
  product_name: string;
  quantity: number;
  unit: string;
  brand: string | null;
  impa_code: string | null;
  description: string | null;
};

type NormalizedQuoteItem = {
  item_temp_id: string;
  unit_price: number;
  total_price: number | null;
  offered_brand: string | null;
  notes: string | null;
};

type NormalizedSupplierQuote = {
  supplier_id: string;
  source_file_url: string | null;
  delivery_time: string | null;
  payment_terms: string | null;
  supplier_notes: string | null;
  items: NormalizedQuoteItem[];
  import_raw: Record<string, unknown> | null;
};

/**
 * Cevaplanmış tekliflerden yeni RFQ + karşılaştırma oluşturma — Phase 1 iskeleti.
 *
 * Bu fazda yalnızca doğrulama + normalize edilmiş payload önizlemesi döner;
 * rfqs/rfq_items/rfq_recipients/quotes/quote_items insert'i sonraki fazda.
 * Bu akış HİÇBİR koşulda tedarikçilere mail göndermez.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  // Kullanıcı onaylı bir alıcı mı?
  const { data: buyer } = await supabase
    .from("buyers")
    .select("id, status")
    .eq("id", user.id)
    .single();

  if (!buyer || buyer.status !== "approved") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  // ── Başlık / para birimi / not ────────────────────────────────────────────
  const title = asTrimmed(body.title, 200);
  if (!title) {
    return NextResponse.json({ error: "Başlık gerekli." }, { status: 400 });
  }

  const currency = body.currency;
  if (typeof currency !== "string" || !(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) {
    return NextResponse.json({ error: "Geçersiz para birimi." }, { status: 400 });
  }

  const notes = asTrimmed(body.notes, 2000);

  // ── Ürün grupları (items) ─────────────────────────────────────────────────
  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "En az bir ürün gerekli." }, { status: 400 });
  }
  if (rawItems.length > MAX_ITEMS) {
    return NextResponse.json({ error: `En fazla ${MAX_ITEMS} ürün desteklenir.` }, { status: 400 });
  }

  const items: NormalizedItem[] = [];
  const tempIds = new Set<string>();

  for (let i = 0; i < rawItems.length; i++) {
    const raw = rawItems[i];
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: `Ürün ${i + 1}: geçersiz kayıt.` }, { status: 400 });
    }
    const r = raw as Record<string, unknown>;

    const tempId = asTrimmed(r.temp_id, 50);
    if (!tempId) {
      return NextResponse.json({ error: `Ürün ${i + 1}: temp_id gerekli.` }, { status: 400 });
    }
    if (tempIds.has(tempId)) {
      return NextResponse.json({ error: `Ürün ${i + 1}: temp_id tekrar ediyor (${tempId}).` }, { status: 400 });
    }
    tempIds.add(tempId);

    const productName = asTrimmed(r.product_name, 500);
    if (!productName) {
      return NextResponse.json({ error: `Ürün ${i + 1}: ürün adı gerekli.` }, { status: 400 });
    }

    const quantity = r.quantity;
    if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: `"${productName}": geçersiz miktar.` }, { status: 400 });
    }

    const impaRaw = typeof r.impa_code === "string" ? r.impa_code.trim() : null;

    items.push({
      temp_id: tempId,
      order_no: typeof r.order_no === "number" && Number.isFinite(r.order_no) ? r.order_no : i + 1,
      product_name: productName,
      quantity,
      unit: asTrimmed(r.unit, 50) ?? "adet",
      brand: asTrimmed(r.brand, 200),
      // Geçersiz IMPA engellemez, sessizce atılır (parse artefaktı olabilir)
      impa_code: isValidImpa(impaRaw) ? impaRaw : null,
      description: asTrimmed(r.description, 1000),
    });
  }

  // ── Tedarikçi teklifleri (supplierQuotes) ─────────────────────────────────
  const rawQuotes = body.supplierQuotes;
  if (!Array.isArray(rawQuotes) || rawQuotes.length === 0) {
    return NextResponse.json({ error: "En az bir tedarikçi dosyası gerekli." }, { status: 400 });
  }
  if (rawQuotes.length > MAX_SUPPLIER_FILES) {
    return NextResponse.json({ error: `En fazla ${MAX_SUPPLIER_FILES} tedarikçi dosyası desteklenir.` }, { status: 400 });
  }

  const supplierQuotes: NormalizedSupplierQuote[] = [];
  const supplierIds = new Set<string>();

  for (let i = 0; i < rawQuotes.length; i++) {
    const raw = rawQuotes[i];
    if (typeof raw !== "object" || raw === null) {
      return NextResponse.json({ error: `Dosya ${i + 1}: geçersiz kayıt.` }, { status: 400 });
    }
    const r = raw as Record<string, unknown>;

    if (!isUuid(r.supplier_id)) {
      return NextResponse.json({ error: `Dosya ${i + 1}: geçersiz tedarikçi.` }, { status: 400 });
    }
    if (supplierIds.has(r.supplier_id)) {
      return NextResponse.json(
        { error: `Dosya ${i + 1}: aynı tedarikçi birden fazla dosyaya atanamaz.` },
        { status: 400 }
      );
    }
    supplierIds.add(r.supplier_id);

    const rawQuoteItems = r.items;
    if (!Array.isArray(rawQuoteItems) || rawQuoteItems.length === 0) {
      return NextResponse.json({ error: `Dosya ${i + 1}: en az bir fiyatlı kalem gerekli.` }, { status: 400 });
    }

    const quoteItems: NormalizedQuoteItem[] = [];
    const seenTempIds = new Set<string>();

    for (let j = 0; j < rawQuoteItems.length; j++) {
      const qi = rawQuoteItems[j];
      if (typeof qi !== "object" || qi === null) {
        return NextResponse.json({ error: `Dosya ${i + 1}, kalem ${j + 1}: geçersiz kayıt.` }, { status: 400 });
      }
      const q = qi as Record<string, unknown>;

      const itemTempId = typeof q.item_temp_id === "string" ? q.item_temp_id.trim() : "";
      if (!itemTempId || !tempIds.has(itemTempId)) {
        return NextResponse.json(
          { error: `Dosya ${i + 1}, kalem ${j + 1}: bilinmeyen ürün referansı.` },
          { status: 400 }
        );
      }
      if (seenTempIds.has(itemTempId)) {
        return NextResponse.json(
          { error: `Dosya ${i + 1}: aynı ürüne birden fazla fiyat verilemez (${itemTempId}).` },
          { status: 400 }
        );
      }
      seenTempIds.add(itemTempId);

      if (!isNonNegativeNumber(q.unit_price)) {
        return NextResponse.json(
          { error: `Dosya ${i + 1}, kalem ${j + 1}: geçersiz birim fiyat.` },
          { status: 400 }
        );
      }
      if (q.total_price != null && !isNonNegativeNumber(q.total_price)) {
        return NextResponse.json(
          { error: `Dosya ${i + 1}, kalem ${j + 1}: geçersiz toplam fiyat.` },
          { status: 400 }
        );
      }

      quoteItems.push({
        item_temp_id: itemTempId,
        unit_price: q.unit_price,
        total_price: isNonNegativeNumber(q.total_price) ? q.total_price : null,
        offered_brand: asTrimmed(q.offered_brand, 200),
        notes: asTrimmed(q.notes, 1000),
      });
    }

    supplierQuotes.push({
      supplier_id: r.supplier_id,
      source_file_url: asTrimmed(r.source_file_url, 500),
      delivery_time: asTrimmed(r.delivery_time, 500),
      payment_terms: asTrimmed(r.payment_terms, 500),
      supplier_notes: asTrimmed(r.supplier_notes, 2000),
      items: quoteItems,
      import_raw:
        typeof r.import_raw === "object" && r.import_raw !== null && !Array.isArray(r.import_raw)
          ? (r.import_raw as Record<string, unknown>)
          : null,
    });
  }

  // ── Tedarikçi sahipliği (tek sorgu, RLS doğrular) ─────────────────────────
  const { data: ownedSuppliers } = await supabase
    .from("suppliers")
    .select("id")
    .eq("buyer_id", user.id)
    .in("id", Array.from(supplierIds));

  const ownedIds = new Set((ownedSuppliers ?? []).map((s) => s.id));
  const unknownSupplier = Array.from(supplierIds).find((sid) => !ownedIds.has(sid));
  if (unknownSupplier) {
    return NextResponse.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });
  }

  // ── Özet: tedarikçi başına sunucu hesaplı toplam ──────────────────────────
  const itemQty = new Map(items.map((it) => [it.temp_id, it.quantity]));
  const supplierSummaries = supplierQuotes.map((sq) => ({
    supplier_id: sq.supplier_id,
    item_count: sq.items.length,
    computed_total:
      Math.round(
        sq.items.reduce((sum, qi) => sum + qi.unit_price * (itemQty.get(qi.item_temp_id) ?? 1), 0) * 100
      ) / 100,
  }));

  // Phase 1: yalnızca doğrulama — Phase 2 bu normalize payload'ı
  // rfqs → rfq_items → rfq_recipients → quotes → quote_items sırasıyla yazacak
  // (recipient'lar status='responded', sent_at=null; mail gönderilmez)
  return NextResponse.json({
    ok: true,
    can_create: true,
    summary: {
      title,
      currency: currency as Currency,
      item_count: items.length,
      supplier_count: supplierQuotes.length,
      suppliers: supplierSummaries,
    },
    normalized: { title, currency, notes, items, supplierQuotes },
  });
}

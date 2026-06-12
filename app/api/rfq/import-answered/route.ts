import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
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
 * Cevaplanmış tekliflerden yeni RFQ + karşılaştırma oluşturur.
 *
 * Sıra: rfqs → rfq_items → rfq_recipients → quotes → quote_items;
 * herhangi bir adım başarısız olursa ters sırada temizlenir.
 * Bu akış HİÇBİR koşulda tedarikçilere mail göndermez —
 * recipient'lar status='responded' + sent_at=null ile doğar,
 * /api/rfq/send'in status='sent' filtresi onları hiç görmez.
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

  // ══ Insert zinciri (admin client — quotes/quote_items RLS gereği) ═════════
  const admin = createAdminClient();
  const itemQty = new Map(items.map((it) => [it.temp_id, it.quantity]));
  const now = new Date().toISOString();

  // 1) rfqs
  const { data: rfq, error: rfqErr } = await admin
    .from("rfqs")
    .insert({
      buyer_id: user.id,
      title,
      notes,
      status: "open",
      deadline: null,
      currency,
      source_type: "imported_quotes",
    })
    .select("id")
    .single();

  if (rfqErr || !rfq) {
    console.error("import-answered rfq insert error:", rfqErr?.code);
    return NextResponse.json({ error: "Karşılaştırma oluşturulamadı. Lütfen tekrar deneyin." }, { status: 500 });
  }

  // Ters sıralı temizlik: quote_items → quotes → rfq_recipients → rfq_items → rfqs.
  // Temizlik hataları yalnızca loglanır (orders route'undaki rollback deseni).
  const rollback = async (quoteIds: string[]) => {
    try {
      if (quoteIds.length > 0) {
        await admin.from("quote_items").delete().in("quote_id", quoteIds);
        await admin.from("quotes").delete().in("id", quoteIds);
      }
      await admin.from("rfq_recipients").delete().eq("rfq_id", rfq.id);
      await admin.from("rfq_items").delete().eq("rfq_id", rfq.id);
      await admin.from("rfqs").delete().eq("id", rfq.id);
    } catch (cleanupErr) {
      console.error("import-answered rollback error:", cleanupErr);
    }
  };

  // 2) rfq_items — order_no sunucuda sıralı atanır; temp_id eşlemesi order_no üzerinden
  const { data: insertedItems, error: itemsErr } = await admin
    .from("rfq_items")
    .insert(
      items.map((it, idx) => ({
        rfq_id: rfq.id,
        order_no: idx + 1,
        product_name: it.product_name,
        quantity: it.quantity,
        unit: it.unit,
        brand: it.brand,
        impa_code: it.impa_code,
        description: it.description,
      }))
    )
    .select("id, order_no");

  if (itemsErr || !insertedItems || insertedItems.length !== items.length) {
    console.error("import-answered rfq_items insert error:", itemsErr?.code);
    await rollback([]);
    return NextResponse.json({ error: "Ürünler kaydedilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }

  const itemIdByTemp = new Map<string, string>();
  for (const row of insertedItems) {
    const source = items[row.order_no - 1];
    if (source) itemIdByTemp.set(source.temp_id, row.id);
  }

  // 3) rfq_recipients — responded olarak doğar; sent_at explicit null
  //    (kolon default'u now() — mail gönderilmiş izlenimi bırakmamalı)
  const { data: insertedRecipients, error: recipErr } = await admin
    .from("rfq_recipients")
    .insert(
      supplierQuotes.map((sq) => ({
        rfq_id: rfq.id,
        supplier_id: sq.supplier_id,
        status: "responded",
        sent_at: null,
        responded_at: now,
      }))
    )
    .select("id, supplier_id");

  if (recipErr || !insertedRecipients || insertedRecipients.length !== supplierQuotes.length) {
    console.error("import-answered rfq_recipients insert error:", recipErr?.code);
    await rollback([]);
    return NextResponse.json({ error: "Tedarikçiler kaydedilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }

  const recipientBySupplier = new Map(insertedRecipients.map((r) => [r.supplier_id, r.id]));

  // 4) quotes — total_amount sunucuda hesaplanır, client'a güvenilmez
  const { data: insertedQuotes, error: quotesErr } = await admin
    .from("quotes")
    .insert(
      supplierQuotes.map((sq) => ({
        rfq_recipient_id: recipientBySupplier.get(sq.supplier_id),
        total_amount:
          Math.round(
            sq.items.reduce((sum, qi) => sum + qi.unit_price * (itemQty.get(qi.item_temp_id) ?? 1), 0) * 100
          ) / 100,
        currency,
        delivery_time: sq.delivery_time,
        payment_terms: sq.payment_terms,
        supplier_notes: sq.supplier_notes,
        source: "imported",
        imported_at: now,
        source_file_url: sq.source_file_url,
        import_raw: sq.import_raw,
      }))
    )
    .select("id, rfq_recipient_id");

  if (quotesErr || !insertedQuotes || insertedQuotes.length !== supplierQuotes.length) {
    console.error("import-answered quotes insert error:", quotesErr?.code);
    await rollback([]);
    return NextResponse.json({ error: "Teklifler kaydedilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }

  const quoteIds = insertedQuotes.map((q) => q.id);
  const quoteByRecipient = new Map(insertedQuotes.map((q) => [q.rfq_recipient_id, q.id]));

  // 5) quote_items — total_price sunucuda: unit_price × rfq_item miktarı
  const quoteItemRows: Record<string, unknown>[] = [];
  for (const sq of supplierQuotes) {
    const recipientId = recipientBySupplier.get(sq.supplier_id);
    const quoteId = recipientId ? quoteByRecipient.get(recipientId) : undefined;
    for (const qi of sq.items) {
      quoteItemRows.push({
        quote_id: quoteId,
        rfq_item_id: itemIdByTemp.get(qi.item_temp_id),
        unit_price: qi.unit_price,
        total_price: Math.round(qi.unit_price * (itemQty.get(qi.item_temp_id) ?? 1) * 100) / 100,
        offered_brand: qi.offered_brand,
        notes: qi.notes,
        in_stock: true,
      });
    }
  }

  const { error: quoteItemsErr } = await admin.from("quote_items").insert(quoteItemRows);

  if (quoteItemsErr) {
    console.error("import-answered quote_items insert error:", quoteItemsErr.code);
    await rollback(quoteIds);
    return NextResponse.json({ error: "Teklif kalemleri kaydedilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    rfq_id: rfq.id,
    item_count: items.length,
    supplier_count: supplierQuotes.length,
    quote_count: insertedQuotes.length,
  });
}

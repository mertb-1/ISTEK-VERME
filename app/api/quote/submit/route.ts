import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Sadece izin verilen alanlar quote_items'a yazılır — injection önlemi
const ALLOWED_ITEM_KEYS = ["rfq_item_id", "unit_price", "total_price", "offered_brand", "in_stock"] as const;

function sanitizeItem(item: Record<string, unknown>, quoteId: string) {
  const safe: Record<string, unknown> = { quote_id: quoteId };
  for (const key of ALLOWED_ITEM_KEYS) {
    if (key in item) safe[key] = item[key];
  }
  return safe;
}

// UUID format kontrolü
function isUuid(val: unknown): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { token, recipient_id, delivery_time, payment_terms, supplier_notes, total_amount, items } = body;

  if (!isUuid(token) || !isUuid(recipient_id)) {
    return NextResponse.json({ error: "Geçersiz bağlantı." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Token + recipient_id birlikte doğrula (ikisi eşleşmeli)
  const { data: recipient } = await supabase
    .from("rfq_recipients")
    .select("id, magic_token, status, rfqs(deadline)")
    .eq("magic_token", token)
    .eq("id", recipient_id)
    .single();

  if (!recipient) {
    return NextResponse.json({ error: "Geçersiz bağlantı." }, { status: 404 });
  }

  if (recipient.status === "responded") {
    return NextResponse.json({ error: "Bu teklif zaten gönderilmiş." }, { status: 409 });
  }

  // Deadline + 7 gün süre kontrolü
  const rfq = (Array.isArray(recipient.rfqs) ? recipient.rfqs[0] : recipient.rfqs) as { deadline?: string };
  if (rfq?.deadline) {
    const expiry = new Date(new Date(rfq.deadline).getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() > expiry) {
      return NextResponse.json({ error: "Bu bağlantının süresi dolmuş." }, { status: 410 });
    }
  }

  // total_amount sayısal doğrulama
  const parsedTotal = total_amount != null ? Number(total_amount) : null;
  if (parsedTotal !== null && (isNaN(parsedTotal) || parsedTotal < 0)) {
    return NextResponse.json({ error: "Geçersiz tutar." }, { status: 400 });
  }

  // Quote oluştur
  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .insert({
      rfq_recipient_id: recipient_id,
      delivery_time: typeof delivery_time === "string" ? delivery_time.slice(0, 500) : null,
      payment_terms: typeof payment_terms === "string" ? payment_terms.slice(0, 500) : null,
      supplier_notes: typeof supplier_notes === "string" ? supplier_notes.slice(0, 2000) : null,
      total_amount: parsedTotal,
    })
    .select("id")
    .single();

  if (quoteErr) {
    console.error("quote insert error:", quoteErr.code);
    return NextResponse.json({ error: "Teklif kaydedilemedi. Lütfen tekrar deneyin." }, { status: 500 });
  }

  // Quote items — sadece izin verilen alanlar
  if (Array.isArray(items) && items.length > 0) {
    const safeItems = items
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => sanitizeItem(item, quote.id));

    const { error: itemsErr } = await supabase.from("quote_items").insert(safeItems);
    if (itemsErr) {
      console.error("quote_items insert error:", itemsErr.code);
      return NextResponse.json({ error: "Teklif kalemleri kaydedilemedi. Lütfen tekrar deneyin." }, { status: 500 });
    }
  }

  // Recipient durumunu güncelle
  const { error: updateErr } = await supabase
    .from("rfq_recipients")
    .update({ status: "responded", responded_at: new Date().toISOString() })
    .eq("id", recipient_id);

  if (updateErr) {
    console.error("recipient update error:", updateErr.code);
    // Quote kaydedildi, bu hatayı kullanıcıya yansıtmıyoruz
  }

  return NextResponse.json({ success: true });
}

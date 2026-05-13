import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, recipient_id, delivery_time, payment_terms, supplier_notes, total_amount, items } = body;

  if (!token || !recipient_id) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Token doğrula
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

  // Süre kontrolü
  const rfq = (Array.isArray(recipient.rfqs) ? recipient.rfqs[0] : recipient.rfqs) as { deadline?: string };
  if (rfq?.deadline) {
    const expiry = new Date(new Date(rfq.deadline).getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() > expiry) {
      return NextResponse.json({ error: "Bu bağlantının süresi dolmuş." }, { status: 410 });
    }
  }

  // Quote oluştur
  const { data: quote, error: quoteErr } = await supabase
    .from("quotes")
    .insert({
      rfq_recipient_id: recipient_id,
      delivery_time,
      payment_terms,
      supplier_notes,
      total_amount,
    })
    .select("id")
    .single();

  if (quoteErr) {
    return NextResponse.json({ error: quoteErr.message }, { status: 500 });
  }

  // Quote items ekle
  if (items && items.length > 0) {
    const { error: itemsErr } = await supabase.from("quote_items").insert(
      items.map((item: Record<string, unknown>) => ({ ...item, quote_id: quote.id }))
    );
    if (itemsErr) {
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }
  }

  // Recipient durumunu güncelle
  await supabase
    .from("rfq_recipients")
    .update({ status: "responded", responded_at: new Date().toISOString() })
    .eq("id", recipient_id);

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// UUID format kontrolü
function isUuid(val: unknown): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

/**
 * Cevaplanmış teklif içe aktarma — Phase 1 iskeleti.
 *
 * Bu aşamada yalnızca doğrulama yapılır ve import bağlamı döndürülür;
 * parse, quote/quote_items insert ve UI sonraki fazlarda eklenecek.
 * Tedarikçi teklif akışına (/api/quote/submit) dokunmaz.
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

  const { rfq_id, supplier_id } = body;

  if (!isUuid(rfq_id) || !isUuid(supplier_id)) {
    return NextResponse.json({ error: "Geçersiz parametreler." }, { status: 400 });
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

  // RFQ bu kullanıcıya ait mi? (server client — RLS doğrular)
  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, title, status, currency, awarded_recipient_id, split_awarded")
    .eq("id", rfq_id)
    .eq("buyer_id", user.id)
    .single();

  if (!rfq) {
    return NextResponse.json({ error: "Teklif talebi bulunamadı." }, { status: 404 });
  }

  if (rfq.status !== "open") {
    return NextResponse.json({ error: "Bu teklif talebi kapatılmış; teklif içe aktarılamaz." }, { status: 409 });
  }

  if (rfq.awarded_recipient_id || rfq.split_awarded) {
    return NextResponse.json({ error: "Bu teklif talebinde zaten bir sipariş var." }, { status: 409 });
  }

  // Tedarikçi bu alıcıya ait mi?
  const { data: supplier } = await supabase
    .from("suppliers")
    .select("id, company_name, contact_name, email")
    .eq("id", supplier_id)
    .eq("buyer_id", user.id)
    .single();

  if (!supplier) {
    return NextResponse.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });
  }

  // Tedarikçi bu RFQ'da recipient mı? (admin — RLS bypass; olmaması hata değil,
  // sonraki fazda import sırasında recipient oluşturulacak)
  const admin = createAdminClient();
  const { data: recipient } = await admin
    .from("rfq_recipients")
    .select("id, status, responded_at, awarded_at")
    .eq("rfq_id", rfq_id)
    .eq("supplier_id", supplier_id)
    .maybeSingle();

  if (recipient) {
    if (recipient.awarded_at) {
      return NextResponse.json({ error: "Bu tedarikçiye zaten sipariş verilmiş." }, { status: 409 });
    }

    // Mevcut teklif varsa üzerine yazılmaz — denetlenebilirlik korunur
    const { data: existingQuote } = await admin
      .from("quotes")
      .select("id, source")
      .eq("rfq_recipient_id", recipient.id)
      .maybeSingle();

    if (existingQuote) {
      return NextResponse.json(
        {
          error:
            existingQuote.source === "imported"
              ? "Bu tedarikçi için zaten içe aktarılmış bir teklif var."
              : "Bu tedarikçi teklifini zaten göndermiş.",
        },
        { status: 409 }
      );
    }
  }

  // Phase 1: yalnızca doğrulama — sonraki fazlar bu bağlam üzerine
  // parse sonucu + kalem eşleştirmesini ekleyip quote/quote_items yazacak
  return NextResponse.json({
    ok: true,
    can_import: true,
    rfq: {
      id: rfq.id,
      title: rfq.title,
      status: rfq.status,
      currency: rfq.currency,
    },
    supplier: {
      id: supplier.id,
      company_name: supplier.company_name,
      contact_name: supplier.contact_name,
      email: supplier.email,
    },
    recipient: recipient
      ? { id: recipient.id, status: recipient.status, responded_at: recipient.responded_at }
      : null,
  });
}

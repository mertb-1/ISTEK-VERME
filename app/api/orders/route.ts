import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMailTemplate, replaceVars, buildMailHtml, sendSimpleMail, esc } from "@/lib/mail";
import { MAIL_DEFAULTS } from "@/lib/mail-defaults";
import { APP_NAME } from "@/lib/config";

function isUuid(val: unknown): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

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

  const { rfq_id, rfq_recipient_id, quote_id, buyer_note, confirmation_note, expected_delivery } = body;

  if (!isUuid(rfq_id) || !isUuid(rfq_recipient_id) || !isUuid(quote_id)) {
    return NextResponse.json({ error: "Geçersiz parametreler." }, { status: 400 });
  }

  const admin = createAdminClient();

  // RFQ bu kullanıcıya ait mi? (server client — RLS doğrulur)
  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, buyer_id, status, awarded_recipient_id")
    .eq("id", rfq_id)
    .eq("buyer_id", user.id)
    .single();

  if (!rfq) return NextResponse.json({ error: "Teklif talebi bulunamadı." }, { status: 404 });

  if (rfq.awarded_recipient_id) {
    return NextResponse.json({ error: "Bu teklif talebinde zaten bir sipariş var." }, { status: 409 });
  }

  // rfq_recipient bu rfq'ya ait mi ve henüz award edilmedi mi?
  const { data: recipient } = await admin
    .from("rfq_recipients")
    .select("id, rfq_id, status, awarded_at")
    .eq("id", rfq_recipient_id)
    .eq("rfq_id", rfq_id)
    .single();

  if (!recipient) return NextResponse.json({ error: "Tedarikçi bulunamadı." }, { status: 404 });

  if (recipient.awarded_at) {
    return NextResponse.json({ error: "Bu tedarikçi zaten seçilmiş." }, { status: 409 });
  }

  // quote bu recipient'a ait mi ve fiyat var mı?
  const { data: quote } = await admin
    .from("quotes")
    .select("id, rfq_recipient_id, total_amount, quote_items(id, rfq_item_id, unit_price, total_price, offered_brand, in_stock)")
    .eq("id", quote_id)
    .eq("rfq_recipient_id", rfq_recipient_id)
    .single();

  if (!quote) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  // orders INSERT (server client — RLS buyer_id kontrolü yapar)
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      rfq_id,
      rfq_recipient_id,
      quote_id,
      buyer_id: user.id,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      buyer_note: typeof buyer_note === "string" ? buyer_note.slice(0, 2000) : null,
      confirmation_note: typeof confirmation_note === "string" ? confirmation_note.slice(0, 2000) : null,
      confirmed_amount: quote.total_amount ?? null,
      expected_delivery: typeof expected_delivery === "string" && expected_delivery ? expected_delivery : null,
    })
    .select("id")
    .single();

  if (orderErr) {
    console.error("orders insert error:", orderErr.code, orderErr.message);
    return NextResponse.json({ error: "Sipariş oluşturulamadı." }, { status: 500 });
  }

  // order_items INSERT — quote_items'tan kopyala
  type QuoteItem = { id: string; rfq_item_id: string; unit_price: number; total_price: number; offered_brand: string; in_stock: boolean };
  const quoteItems = (Array.isArray(quote.quote_items) ? quote.quote_items : []) as QuoteItem[];

  if (quoteItems.length > 0) {
    // rfq_items'tan quantity bilgisini çek
    const rfqItemIds = quoteItems.map((qi) => qi.rfq_item_id);
    const { data: rfqItems } = await admin
      .from("rfq_items")
      .select("id, quantity")
      .in("id", rfqItemIds);

    const qtyMap = new Map((rfqItems ?? []).map((ri: { id: string; quantity: number }) => [ri.id, ri.quantity]));

    const orderItemsPayload = quoteItems.map((qi) => ({
      order_id: order.id,
      rfq_item_id: qi.rfq_item_id,
      quote_item_id: qi.id,
      confirmed_unit_price: qi.unit_price,
      confirmed_quantity: qtyMap.get(qi.rfq_item_id) ?? null,
      confirmed_brand: qi.offered_brand || null,
    }));

    const { error: itemsErr } = await supabase
      .from("order_items")
      .insert(orderItemsPayload);

    if (itemsErr) {
      console.error("order_items insert error:", itemsErr.code, itemsErr.message);
      // Sipariş oluşturuldu ama kalemler yazılamadı — siparişi temizle
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Sipariş kalemleri kaydedilemedi." }, { status: 500 });
    }
  }

  // rfq_recipients: awarded_at ve order_id güncelle (admin — RLS bypass)
  const { error: recipientErr } = await admin
    .from("rfq_recipients")
    .update({ awarded_at: new Date().toISOString(), order_id: order.id })
    .eq("id", rfq_recipient_id);

  if (recipientErr) {
    console.error("rfq_recipients update error:", recipientErr.code);
  }

  // rfqs: awarded_recipient_id ve status güncelle
  const { error: rfqErr } = await supabase
    .from("rfqs")
    .update({ awarded_recipient_id: rfq_recipient_id, status: "closed" })
    .eq("id", rfq_id);

  if (rfqErr) {
    console.error("rfqs update error:", rfqErr.code);
  }

  // Tedarikçiye sipariş bildirim maili gönder — hata siparişi etkilemez
  try {
    const [supplierRow, buyerRow] = await Promise.all([
      admin
        .from("rfq_recipients")
        .select("magic_token, supplier_id, suppliers(email, contact_name, company_name)")
        .eq("id", rfq_recipient_id)
        .single(),
      admin
        .from("buyers")
        .select("company_name, company_phone, company_email, company_logo_url")
        .eq("id", user.id)
        .single(),
    ]);

    const supplierData = supplierRow.data;
    const buyerData = buyerRow.data;

    const rawSupplier = supplierData?.suppliers;
    const supplierInfo = Array.isArray(rawSupplier) ? rawSupplier[0] : rawSupplier;
    const supplierEmail = supplierInfo?.email as string | undefined;

    if (supplierEmail && buyerData) {
      const magicLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/quote/${supplierData?.magic_token}`;

      const deliveryDate = typeof expected_delivery === "string" && expected_delivery
        ? new Date(expected_delivery).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
        : "Belirtilmemiş";

      const amountFormatted = quote.total_amount != null
        ? Number(quote.total_amount).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "—";

      const orderShort = order.id.slice(0, 8).toUpperCase();
      const rfqShort = rfq_id.slice(0, 8).toUpperCase();

      const vars: Record<string, string> = {
        firma_adi: buyerData.company_name ?? "",
        tedarikci_adi: (supplierInfo?.contact_name as string | undefined) ?? (supplierInfo?.company_name as string | undefined) ?? "",
        teklif_no: `RFQ-${rfqShort}`,
        siparis_no: `ORD-${orderShort}`,
        siparis_tutari: amountFormatted,
        teslim_tarihi: deliveryDate,
        siparis_notu: typeof buyer_note === "string" && buyer_note ? buyer_note.slice(0, 500) : "",
        teklif_linki: magicLink,
        firma_telefon: buyerData.company_phone ?? "",
        firma_mail: buyerData.company_email ?? "",
      };

      const tpl = await getMailTemplate("supplier_order_notification");
      const defaults = MAIL_DEFAULTS.supplier_order_notification;

      const subject = replaceVars(tpl?.subject ?? defaults.subject, vars);
      const greeting = replaceVars(tpl?.greeting ?? defaults.greeting, vars);
      const body = replaceVars(tpl?.body ?? defaults.body, vars);
      const signature = replaceVars(tpl?.signature ?? defaults.signature, vars);

      const html = buildMailHtml({
        greeting,
        greetingAlign: tpl?.greeting_align ?? "left",
        body,
        bodyAlign: tpl?.body_align ?? "left",
        signature,
        signatureAlign: tpl?.signature_align ?? "left",
        logoUrl: buyerData.company_logo_url ?? null,
        companyName: buyerData.company_name ?? APP_NAME,
        type: "supplier_order_notification",
        actionUrl: magicLink,
        appName: APP_NAME,
      });

      await sendSimpleMail({
        to: supplierEmail,
        subject,
        html,
        fromName: `${esc(buyerData.company_name ?? APP_NAME)} via ${APP_NAME}`,
        replyTo: buyerData.company_email ?? undefined,
      });
    }
  } catch (mailErr) {
    console.error("supplier_order_notification mail error:", mailErr);
  }

  return NextResponse.json({ order_id: order.id });
}

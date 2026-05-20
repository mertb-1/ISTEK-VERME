import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMailTemplate, replaceVars, buildMailHtml, sendSimpleMail } from "@/lib/mail";
import { APP_NAME } from "@/lib/config";

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
    .select("id, magic_token, status, rfqs!rfq_recipients_rfq_id_fkey(deadline)")
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

  // Alıcıya bildirim maili gönder (arka planda, hata olsa da devam et)
  try {
    type RecipientWithRfq = {
      rfq_id: string;
      suppliers: { company_name: string } | { company_name: string }[] | null;
      rfqs: {
        id: string;
        buyer_id: string;
        buyers: { email: string; company_name: string; full_name: string } | { email: string; company_name: string; full_name: string }[] | null;
      } | { id: string; buyer_id: string; buyers: unknown } | { id: string; buyer_id: string; buyers: unknown }[] | null;
    };
    const { data: recipientFull } = await supabase
      .from("rfq_recipients")
      .select("rfq_id, suppliers(company_name), rfqs!rfq_recipients_rfq_id_fkey(id, buyer_id, buyers(email, company_name, full_name))")
      .eq("id", recipient_id)
      .single() as { data: RecipientWithRfq | null };

    if (recipientFull) {
      const rfqData = Array.isArray(recipientFull.rfqs) ? recipientFull.rfqs[0] : recipientFull.rfqs;
      const buyerData = rfqData
        ? (Array.isArray((rfqData as { buyers: unknown }).buyers)
            ? ((rfqData as { buyers: unknown[] }).buyers as { email: string; company_name: string; full_name: string }[])[0]
            : (rfqData as { buyers: { email: string; company_name: string; full_name: string } | null }).buyers)
        : null;
      const supplierData = Array.isArray(recipientFull.suppliers) ? recipientFull.suppliers[0] : recipientFull.suppliers;

      if (buyerData?.email) {
        const template = await getMailTemplate("buyer_notification");
        const rfqNo = (rfqData as { id: string })?.id?.slice(0, 8).toUpperCase() ?? "";
        const today = new Date().toLocaleDateString("tr-TR", {
          day: "numeric", month: "long", year: "numeric",
        });
        const vars: Record<string, string> = {
          alici_adi: buyerData.full_name ?? "",
          tedarikci_adi: supplierData?.company_name ?? "",
          teklif_no: rfqNo,
          cevap_tarihi: today,
          firma_adi: buyerData.company_name ?? APP_NAME,
        };
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const compareUrl = `${appUrl}/rfq/${(rfqData as { id: string })?.id}`;

        const subject = template ? replaceVars(template.subject, vars) : `Teklif Cevabı Geldi - ${rfqNo}`;
        const greeting = template ? replaceVars(template.greeting, vars) : `Sayın ${buyerData.full_name},`;
        const bodyText = template ? replaceVars(template.body, vars) : `${vars.tedarikci_adi} firması teklifinize cevap verdi.`;
        const signature = template ? replaceVars(template.signature, vars) : APP_NAME;

        const html = buildMailHtml({
          greeting,
          body: bodyText,
          signature,
          companyName: buyerData.company_name ?? APP_NAME,
          type: "buyer_notification",
          actionUrl: compareUrl,
          appName: APP_NAME,
        });

        await sendSimpleMail({
          to: buyerData.email,
          subject,
          html,
          fromName: APP_NAME,
        });
      }
    }
  } catch (mailErr) {
    console.error("buyer_notification mail error:", mailErr);
  }

  return NextResponse.json({ success: true });
}

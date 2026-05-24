import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMailTemplate, replaceVars, buildMailHtml, sendSimpleMail, esc } from "@/lib/mail";
import { MAIL_DEFAULTS } from "@/lib/mail-defaults";
import { APP_NAME } from "@/lib/config";
import { type Currency, SUPPORTED_CURRENCIES } from "@/lib/currency";

function isUuid(val: unknown): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

type AwardEntry = {
  rfq_item_id: string;
  rfq_recipient_id: string;
};

type QuoteItem = {
  id: string;
  rfq_item_id: string;
  unit_price: number;
  total_price: number;
  offered_brand: string | null;
  in_stock: boolean;
};

type Quote = {
  id: string;
  rfq_recipient_id: string;
  total_amount: number;
  quote_items: QuoteItem[];
};

type RecipientRow = {
  id: string;
  awarded_at: string | null;
  magic_token: string;
  supplier_id: string;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { rfq_id, awards, buyer_note, expected_delivery } = body;

  // --- Basic format validation ---
  if (!isUuid(rfq_id)) {
    return NextResponse.json({ error: "Geçersiz rfq_id." }, { status: 400 });
  }

  if (!Array.isArray(awards) || awards.length === 0) {
    return NextResponse.json({ error: "awards alanı boş olamaz." }, { status: 400 });
  }

  for (const entry of awards) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !isUuid((entry as Record<string, unknown>).rfq_item_id) ||
      !isUuid((entry as Record<string, unknown>).rfq_recipient_id)
    ) {
      return NextResponse.json(
        { error: "awards içinde geçersiz rfq_item_id veya rfq_recipient_id." },
        { status: 400 }
      );
    }
  }

  const typedAwards = awards as AwardEntry[];

  // Duplicate rfq_item_id check — each item may only appear once
  const seenItemIds: Record<string, boolean> = {};
  for (const a of typedAwards) {
    if (seenItemIds[a.rfq_item_id]) {
      return NextResponse.json(
        { error: "Bir ürün birden fazla tedarikçiye atanmış." },
        { status: 400 }
      );
    }
    seenItemIds[a.rfq_item_id] = true;
  }

  // --- RFQ ownership and status ---
  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, buyer_id, status, awarded_recipient_id, split_awarded, currency")
    .eq("id", rfq_id)
    .eq("buyer_id", user.id)
    .single();

  if (!rfq) return NextResponse.json({ error: "Teklif talebi bulunamadı." }, { status: 404 });

  if (rfq.status !== "open") {
    return NextResponse.json({ error: "Bu teklif talebi açık değil." }, { status: 409 });
  }

  if (rfq.awarded_recipient_id) {
    return NextResponse.json(
      { error: "Bu teklif talebinde zaten bir sipariş var." },
      { status: 409 }
    );
  }

  if (rfq.split_awarded) {
    return NextResponse.json(
      { error: "Bu teklif talebi karma sipariş ile kapatılmış." },
      { status: 409 }
    );
  }

  const admin = createAdminClient();

  // --- Fetch RFQ items ---
  const { data: rfqItemsRaw } = await admin
    .from("rfq_items")
    .select("id, quantity")
    .eq("rfq_id", rfq_id);

  const rfqItems = (rfqItemsRaw ?? []) as Array<{ id: string; quantity: number }>;

  if (rfqItems.length === 0) {
    return NextResponse.json({ error: "Teklif talebinde ürün bulunamadı." }, { status: 400 });
  }

  const rfqItemQtyRecord: Record<string, number> = {};
  for (const item of rfqItems) {
    rfqItemQtyRecord[item.id] = item.quantity;
  }

  // Every awarded item must belong to this RFQ
  for (const a of typedAwards) {
    if (rfqItemQtyRecord[a.rfq_item_id] === undefined) {
      return NextResponse.json(
        { error: `Ürün bu teklif talebine ait değil: ${a.rfq_item_id}` },
        { status: 400 }
      );
    }
  }

  // --- Fetch responded recipients for this RFQ ---
  const { data: recipientsRaw } = await admin
    .from("rfq_recipients")
    .select("id, awarded_at, magic_token, supplier_id")
    .eq("rfq_id", rfq_id)
    .eq("status", "responded");

  const recipientRecord: Record<string, RecipientRow> = {};
  for (const r of recipientsRaw ?? []) {
    recipientRecord[r.id] = r as RecipientRow;
  }

  // Unique recipient IDs from awards
  const uniqueRecipientIds: string[] = [];
  const seenRecipientIds: Record<string, boolean> = {};
  for (const a of typedAwards) {
    if (!seenRecipientIds[a.rfq_recipient_id]) {
      seenRecipientIds[a.rfq_recipient_id] = true;
      uniqueRecipientIds.push(a.rfq_recipient_id);
    }
  }

  for (const recipientId of uniqueRecipientIds) {
    if (!recipientRecord[recipientId]) {
      return NextResponse.json(
        { error: `Tedarikçi bu teklif talebine ait değil veya henüz cevap vermedi: ${recipientId}` },
        { status: 400 }
      );
    }
    if (recipientRecord[recipientId].awarded_at) {
      return NextResponse.json(
        { error: `Bu tedarikçi zaten seçilmiş: ${recipientId}` },
        { status: 409 }
      );
    }
  }

  // --- Fetch quotes for all unique recipients ---
  const { data: quotesRaw } = await admin
    .from("quotes")
    .select(
      "id, rfq_recipient_id, total_amount, quote_items(id, rfq_item_id, unit_price, total_price, offered_brand, in_stock)"
    )
    .in("rfq_recipient_id", uniqueRecipientIds);

  const quotesRecord: Record<string, Quote> = {};
  for (const q of quotesRaw ?? []) {
    const quoteItems = (Array.isArray(q.quote_items) ? q.quote_items : []) as QuoteItem[];
    quotesRecord[q.rfq_recipient_id] = { ...q, quote_items: quoteItems };
  }

  // Every recipient must have a quote
  for (const recipientId of uniqueRecipientIds) {
    if (!quotesRecord[recipientId]) {
      return NextResponse.json(
        { error: `Tedarikçinin teklifi bulunamadı: ${recipientId}` },
        { status: 400 }
      );
    }
  }

  // Group awards by recipient: Record<rfq_recipient_id, rfq_item_id[]>
  const recipientItemsRecord: Record<string, string[]> = {};
  for (const award of typedAwards) {
    if (!recipientItemsRecord[award.rfq_recipient_id]) {
      recipientItemsRecord[award.rfq_recipient_id] = [];
    }
    recipientItemsRecord[award.rfq_recipient_id].push(award.rfq_item_id);
  }

  // Every awarded item must have a quote_item from that recipient
  for (const recipientId of uniqueRecipientIds) {
    const quote = quotesRecord[recipientId];
    const awardedItemIds = recipientItemsRecord[recipientId];
    const quoteItemIdRecord: Record<string, boolean> = {};
    for (const qi of quote.quote_items) {
      quoteItemIdRecord[qi.rfq_item_id] = true;
    }
    for (const itemId of awardedItemIds) {
      if (!quoteItemIdRecord[itemId]) {
        return NextResponse.json(
          { error: `Ürün için tedarikçinin fiyatı bulunamadı: ${itemId}` },
          { status: 400 }
        );
      }
    }
  }

  // --- Create orders ---
  const buyerNote =
    typeof buyer_note === "string" && buyer_note ? buyer_note.slice(0, 2000) : null;
  const expectedDelivery =
    typeof expected_delivery === "string" && expected_delivery ? expected_delivery : null;

  const orderCurrency: Currency = SUPPORTED_CURRENCIES.includes(rfq.currency as Currency)
    ? (rfq.currency as Currency)
    : "USD";

  const createdOrderIds: string[] = [];
  const createdOrders: Array<{ rfq_recipient_id: string; order_id: string }> = [];

  for (const recipientId of uniqueRecipientIds) {
    const quote = quotesRecord[recipientId];
    const awardedItemIds = recipientItemsRecord[recipientId];

    const relevantQuoteItems = quote.quote_items.filter((qi) =>
      awardedItemIds.includes(qi.rfq_item_id)
    );

    // confirmed_amount = sum of awarded quote_items.total_price only (not quote.total_amount)
    const confirmedAmount = relevantQuoteItems.reduce(
      (sum, qi) => sum + (qi.total_price ?? 0),
      0
    );

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        rfq_id,
        rfq_recipient_id: recipientId,
        quote_id: quote.id,
        buyer_id: user.id,
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_amount: confirmedAmount,
        buyer_note: buyerNote,
        expected_delivery: expectedDelivery,
        currency: orderCurrency,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      console.error("split-award orders insert error:", orderErr?.code, orderErr?.message);
      if (createdOrderIds.length > 0) {
        await supabase.from("orders").delete().in("id", createdOrderIds);
      }
      return NextResponse.json({ error: "Sipariş oluşturulamadı." }, { status: 500 });
    }

    createdOrderIds.push(order.id);

    const orderItemsPayload = relevantQuoteItems.map((qi) => ({
      order_id: order.id,
      rfq_item_id: qi.rfq_item_id,
      quote_item_id: qi.id,
      confirmed_unit_price: qi.unit_price,
      confirmed_quantity: rfqItemQtyRecord[qi.rfq_item_id] ?? null,
      confirmed_brand: qi.offered_brand || null,
    }));

    const { error: itemsErr } = await supabase.from("order_items").insert(orderItemsPayload);

    if (itemsErr) {
      console.error("split-award order_items insert error:", itemsErr.code, itemsErr.message);
      await supabase.from("orders").delete().in("id", createdOrderIds);
      return NextResponse.json({ error: "Sipariş kalemleri kaydedilemedi." }, { status: 500 });
    }

    const { error: recipientErr } = await admin
      .from("rfq_recipients")
      .update({ awarded_at: new Date().toISOString(), order_id: order.id })
      .eq("id", recipientId);

    if (recipientErr) {
      console.error("split-award rfq_recipients update error:", recipientErr.code);
    }

    createdOrders.push({ rfq_recipient_id: recipientId, order_id: order.id });
  }

  // --- Close RFQ only after all orders succeeded ---
  const { error: rfqErr } = await supabase
    .from("rfqs")
    .update({ status: "closed", split_awarded: true })
    .eq("id", rfq_id);

  if (rfqErr) {
    console.error("split-award rfqs update error:", rfqErr.code);
  }

  // --- Send notification emails per recipient — failures do not affect orders ---
  try {
    const { data: buyerData } = await admin
      .from("buyers")
      .select("company_name, company_phone, company_email, company_logo_url")
      .eq("id", user.id)
      .single();

    if (buyerData) {
      const tpl = await getMailTemplate("supplier_order_notification");
      const defaults = MAIL_DEFAULTS.supplier_order_notification;

      for (const { rfq_recipient_id, order_id } of createdOrders) {
        try {
          const recipient = recipientRecord[rfq_recipient_id];
          if (!recipient) continue;

          const { data: supplierRow } = await admin
            .from("suppliers")
            .select("email, contact_name, company_name")
            .eq("id", recipient.supplier_id)
            .single();

          if (!supplierRow?.email) continue;

          const quote = quotesRecord[rfq_recipient_id];
          const awardedItemIds = recipientItemsRecord[rfq_recipient_id];
          const confirmedAmount = quote.quote_items
            .filter((qi) => awardedItemIds.includes(qi.rfq_item_id))
            .reduce((s, qi) => s + (qi.total_price ?? 0), 0);

          const amountFormatted = Number(confirmedAmount).toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

          const deliveryDate = expectedDelivery
            ? new Date(expectedDelivery).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "Belirtilmemiş";

          const orderShort = order_id.slice(0, 8).toUpperCase();
          const rfqShort = (rfq_id as string).slice(0, 8).toUpperCase();
          const magicLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/quote/${recipient.magic_token}`;

          const vars: Record<string, string> = {
            firma_adi: buyerData.company_name ?? "",
            tedarikci_adi:
              (supplierRow.contact_name as string | undefined) ??
              (supplierRow.company_name as string | undefined) ??
              "",
            teklif_no: `RFQ-${rfqShort}`,
            siparis_no: `ORD-${orderShort}`,
            siparis_tutari: amountFormatted,
            teslim_tarihi: deliveryDate,
            siparis_notu: buyerNote ?? "",
            teklif_linki: magicLink,
            firma_telefon: buyerData.company_phone ?? "",
            firma_mail: buyerData.company_email ?? "",
          };

          const subject = replaceVars(tpl?.subject ?? defaults.subject, vars);
          const greeting = replaceVars(tpl?.greeting ?? defaults.greeting, vars);
          const mailBody = replaceVars(tpl?.body ?? defaults.body, vars);
          const signature = replaceVars(tpl?.signature ?? defaults.signature, vars);

          const html = buildMailHtml({
            greeting,
            greetingAlign: tpl?.greeting_align ?? "left",
            body: mailBody,
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
            to: supplierRow.email as string,
            subject,
            html,
            fromName: `${esc(buyerData.company_name ?? APP_NAME)} via ${APP_NAME}`,
            replyTo: buyerData.company_email ?? undefined,
          });
        } catch (mailErr) {
          console.error(`split-award mail error for recipient ${rfq_recipient_id}:`, mailErr);
        }
      }
    }
  } catch (mailErr) {
    console.error("split-award mail setup error:", mailErr);
  }

  return NextResponse.json({ orders: createdOrders });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendRfqMail } from "@/lib/mail";

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

  const { rfq_id } = body;
  if (typeof rfq_id !== "string" || !rfq_id) {
    return NextResponse.json({ error: "rfq_id gerekli." }, { status: 400 });
  }

  const admin = createAdminClient();

  // RFQ sahibinin bu kullanıcı olduğunu doğrula
  const { data: rfq } = await admin
    .from("rfqs")
    .select("id, title, notes, deadline, buyer_id, buyers(company_name)")
    .eq("id", rfq_id)
    .eq("buyer_id", user.id)
    .single();

  if (!rfq) return NextResponse.json({ error: "Teklif bulunamadı." }, { status: 404 });

  const { data: items } = await admin
    .from("rfq_items")
    .select("product_name, brand, quantity, unit")
    .eq("rfq_id", rfq_id)
    .order("order_no");

  // Sadece henüz gönderilmemiş (status=sent ama sent_at null) recipients — veya yeniden gönderim
  const { data: recipients } = await admin
    .from("rfq_recipients")
    .select("id, magic_token, suppliers(company_name, contact_name, email)")
    .eq("rfq_id", rfq_id)
    .eq("status", "sent");

  if (!recipients || recipients.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const buyerCompany =
    (Array.isArray(rfq.buyers) ? rfq.buyers[0] : (rfq.buyers as { company_name?: string }))
      ?.company_name ?? "";

  const results = await Promise.allSettled(
    recipients.map(async (r) => {
      type SupplierInfo = { company_name: string; contact_name: string; email: string };
      const supplier = (Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers) as SupplierInfo;
      if (!supplier?.email) return;

      await sendRfqMail({
        to: supplier.email,
        supplierName: supplier.contact_name || supplier.company_name,
        buyerCompany,
        rfqTitle: rfq.title,
        deadline: rfq.deadline,
        rfqNotes: rfq.notes,
        items: items ?? [],
        magicLink: `${appUrl}/quote/${r.magic_token}`,
      });

      // Gönderim zamanını kaydet — hata olsa bile devam et
      const { error: updateErr } = await admin
        .from("rfq_recipients")
        .update({ sent_at: new Date().toISOString() })
        .eq("id", r.id);

      if (updateErr) {
        console.error("sent_at update error for recipient", r.id, updateErr.code);
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ sent, failed });
}

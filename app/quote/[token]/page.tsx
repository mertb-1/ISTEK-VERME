import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";
import QuoteForm from "./QuoteForm";
import QuoteAwarded from "./QuoteAwarded";

export default async function QuotePage({ params }: { params: { token: string } }) {
  noStore();
  const supabase = createAdminClient();

  // Token ile rfq_recipient bul
  const { data: recipient } = await supabase
    .from("rfq_recipients")
    .select(`
      id, status, magic_token, awarded_at, order_id,
      rfqs!rfq_recipients_rfq_id_fkey(id, title, notes, deadline, buyers(company_name, company_logo_url)),
      suppliers(company_name, contact_name),
      quotes(id)
    `)
    .eq("magic_token", params.token)
    .single();

  if (!recipient) notFound();

  // Süresi geçmiş mi kontrol et
  type RfqData = { id: string; title: string; notes: string; deadline: string; buyers: { company_name: string; company_logo_url?: string | null } | { company_name: string; company_logo_url?: string | null }[] };
  const rfq = (Array.isArray(recipient.rfqs) ? recipient.rfqs[0] : recipient.rfqs) as RfqData;
  if (rfq?.deadline) {
    const deadline = new Date(rfq.deadline);
    const expiry = new Date(deadline.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() > expiry) redirect(`/quote/${params.token}/expired`);
  }

  type SupplierData = { company_name: string; contact_name: string };
  const supplier = (Array.isArray(recipient.suppliers) ? recipient.suppliers[0] : recipient.suppliers) as SupplierData;
  const buyer = (Array.isArray(rfq.buyers) ? rfq.buyers[0] : rfq.buyers) as { company_name: string; company_logo_url?: string | null };

  // Award edilmiş tedarikçi: read-only onay sayfası göster
  if (recipient.awarded_at || recipient.order_id) {
    let confirmedAmount: number | null = null;
    let expectedDelivery: string | null = null;
    let buyerNote: string | null = null;

    if (recipient.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("confirmed_amount, expected_delivery, buyer_note")
        .eq("id", recipient.order_id)
        .single();
      if (order) {
        confirmedAmount = order.confirmed_amount ?? null;
        expectedDelivery = order.expected_delivery ?? null;
        buyerNote = order.buyer_note ?? null;
      }
    }

    return (
      <QuoteAwarded
        buyerCompany={buyer?.company_name ?? ""}
        buyerLogoUrl={buyer?.company_logo_url ?? null}
        rfqTitle={rfq.title}
        confirmedAmount={confirmedAmount}
        expectedDelivery={expectedDelivery}
        buyerNote={buyerNote}
        supplierName={supplier?.contact_name ?? supplier?.company_name}
      />
    );
  }

  // Zaten cevap verdiyse (award olmadan) success sayfasına yönlendir
  if (recipient.status === "responded") redirect(`/quote/${params.token}/success`);

  // Teklifteki ürünleri getir
  const { data: items } = await supabase
    .from("rfq_items")
    .select("*")
    .eq("rfq_id", rfq.id)
    .order("order_no");

  return (
    <QuoteForm
      token={params.token}
      recipientId={recipient.id}
      rfq={{ title: rfq.title, notes: rfq.notes, deadline: rfq.deadline }}
      supplier={{ company_name: supplier?.company_name, contact_name: supplier?.contact_name }}
      buyerCompany={buyer?.company_name ?? ""}
      buyerLogoUrl={buyer?.company_logo_url ?? null}
      items={items ?? []}
    />
  );
}

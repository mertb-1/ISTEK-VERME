import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import QuoteForm from "./QuoteForm";

export default async function QuotePage({ params }: { params: { token: string } }) {
  const supabase = createAdminClient();

  // Token ile rfq_recipient bul
  const { data: recipient } = await supabase
    .from("rfq_recipients")
    .select(`
      id, status, magic_token,
      rfqs(id, title, notes, deadline, buyers(company_name)),
      suppliers(company_name, contact_name),
      quotes(id)
    `)
    .eq("magic_token", params.token)
    .single();

  if (!recipient) notFound();

  // Süresi geçmiş mi kontrol et
  type RfqData = { id: string; title: string; notes: string; deadline: string; buyers: { company_name: string } | { company_name: string }[] };
  const rfq = (Array.isArray(recipient.rfqs) ? recipient.rfqs[0] : recipient.rfqs) as RfqData;
  if (rfq?.deadline) {
    const deadline = new Date(rfq.deadline);
    const expiry = new Date(deadline.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (new Date() > expiry) redirect(`/quote/${params.token}/expired`);
  }

  // Zaten cevap verdiyse success sayfasına yönlendir
  if (recipient.status === "responded") redirect(`/quote/${params.token}/success`);

  // Teklifteki ürünleri getir
  const { data: items } = await supabase
    .from("rfq_items")
    .select("*")
    .eq("rfq_id", rfq.id)
    .order("order_no");

  type SupplierData = { company_name: string; contact_name: string };
  const supplier = (Array.isArray(recipient.suppliers) ? recipient.suppliers[0] : recipient.suppliers) as SupplierData;
  const buyer = (Array.isArray(rfq.buyers) ? rfq.buyers[0] : rfq.buyers) as { company_name: string };

  return (
    <QuoteForm
      token={params.token}
      recipientId={recipient.id}
      rfq={{ title: rfq.title, notes: rfq.notes, deadline: rfq.deadline }}
      supplier={{ company_name: supplier?.company_name, contact_name: supplier?.contact_name }}
      buyerCompany={buyer?.company_name ?? ""}
      items={items ?? []}
    />
  );
}

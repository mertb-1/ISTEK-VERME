import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import RfqDetail from "./RfqDetail";

export const dynamic = "force-dynamic";

export default async function RfqDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("*")
    .eq("id", params.id)
    .eq("buyer_id", user!.id)
    .single();

  if (!rfq) notFound();

  const { data: items } = await supabase
    .from("rfq_items")
    .select("*")
    .eq("rfq_id", rfq.id)
    .order("order_no");

  const admin = createAdminClient();

  const { data: recipients } = await admin
    .from("rfq_recipients")
    .select("id, status, magic_token, sent_at, responded_at, awarded_at, order_id, suppliers(id, company_name, email, contact_name)")
    .eq("rfq_id", rfq.id);

  const { data: quotes } = await admin
    .from("quotes")
    .select("id, rfq_recipient_id, total_amount, delivery_time, payment_terms, supplier_notes, quote_items(id, rfq_item_id, unit_price, total_price, offered_brand, in_stock, notes)")
    .in("rfq_recipient_id", (recipients ?? []).map((r) => r.id));

  const recipientsWithQuotes = (recipients ?? []).map((r) => ({
    ...r,
    quotes: (quotes ?? []).filter((q) => q.rfq_recipient_id === r.id),
  }));

  return <RfqDetail rfq={rfq} items={items ?? []} recipients={recipientsWithQuotes} />;
}

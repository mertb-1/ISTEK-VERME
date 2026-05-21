import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OrdersList, { OrderRow } from "./OrdersList";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  // Explicit FK hints required — orders↔rfq_recipients and orders↔rfqs both have circular FKs
  const { data: orders, error: ordersErr } = await admin
    .from("orders")
    .select(`
      id, status, confirmed_amount, expected_delivery, created_at, rfq_id, rfq_recipient_id,
      rfqs!orders_rfq_id_fkey(id, title),
      rfq_recipients!orders_rfq_recipient_id_fkey(suppliers(company_name))
    `)
    .eq("buyer_id", user!.id)
    .order("created_at", { ascending: false });

  if (ordersErr) console.error("orders fetch error:", ordersErr.code, ordersErr.message);

  const rows: OrderRow[] = (orders ?? []).map((o) => {
    const rfq = (Array.isArray(o.rfqs) ? o.rfqs[0] : o.rfqs) as { id: string; title: string } | null;
    const recipient = (Array.isArray(o.rfq_recipients) ? o.rfq_recipients[0] : o.rfq_recipients) as { suppliers: unknown } | null;
    const supplier = recipient?.suppliers
      ? ((Array.isArray(recipient.suppliers) ? recipient.suppliers[0] : recipient.suppliers) as { company_name: string } | null)
      : null;

    return {
      id: o.id,
      status: o.status,
      confirmed_amount: o.confirmed_amount,
      expected_delivery: o.expected_delivery,
      created_at: o.created_at,
      rfq_title: rfq?.title ?? null,
      rfq_id: rfq?.id ?? null,
      supplier_name: supplier?.company_name ?? null,
    };
  });

  const total = rows.length;
  const active = rows.filter((r) => r.status !== "cancelled" && r.status !== "completed").length;
  const completed = rows.filter((r) => r.status === "completed").length;

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        eyebrow="SATIN ALMA · SİPARİŞLER"
        title="Sipariş"
        accentWord="kütüğü."
        description="Onaylanan tüm siparişleriniz ve güncel durumları."
      />

      {total > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="TOPLAM" value={total} />
          <StatCard label="AKTİF" value={active} variant="warning" />
          <StatCard label="TAMAMLANDI" value={completed} variant="success" />
        </div>
      )}

      <OrdersList orders={rows} />
    </div>
  );
}

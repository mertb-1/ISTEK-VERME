import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OrdersList, { OrderRow } from "./OrdersList";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: orders } = await admin
    .from("orders")
    .select(`
      id, status, confirmed_amount, expected_delivery, created_at, rfq_id, rfq_recipient_id,
      rfqs(id, title),
      rfq_recipients(suppliers(company_name))
    `)
    .eq("buyer_id", user!.id)
    .order("created_at", { ascending: false });

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
      {/* Heading */}
      <div className="mb-8">
        <p className="text-xs tracking-widest mb-3" style={{ color: "#7a6e67", letterSpacing: "0.12em" }}>
          SATIN ALMA · SİPARİŞLER
        </p>
        <h1 className="font-display text-5xl leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Sipariş <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>kütüğü.</em>
        </h1>
        <p className="text-sm mt-2" style={{ color: "#7a6e67" }}>
          Onaylanan tüm siparişleriniz ve güncel durumları.
        </p>
      </div>

      {/* Stats */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "TOPLAM", value: total },
            { label: "AKTİF", value: active },
            { label: "TAMAMLANDI", value: completed },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
              <p className="text-xs tracking-widest mb-1" style={{ color: "#7a6e67", letterSpacing: "0.1em" }}>{s.label}</p>
              <p className="font-display text-3xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#111" }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <OrdersList orders={rows} />
    </div>
  );
}

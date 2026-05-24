import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import OrderActions from "./OrderActions";
import StatusBadge from "@/components/StatusBadge";
import { formatMoney } from "@/lib/currency";

export const dynamic = "force-dynamic";

function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("tr-TR");
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, confirmed_amount, expected_delivery, created_at, buyer_note, confirmation_note, rfq_id, rfq_recipient_id, currency")
    .eq("id", params.id)
    .eq("buyer_id", user!.id)
    .single();

  if (!order) notFound();

  const admin = createAdminClient();

  const [{ data: rfq }, { data: recipient }, { data: orderItems }] = await Promise.all([
    supabase.from("rfqs").select("id, title").eq("id", order.rfq_id).single(),
    admin.from("rfq_recipients").select("suppliers(id, company_name, contact_name, email)").eq("id", order.rfq_recipient_id).single(),
    admin.from("order_items")
      .select("id, confirmed_unit_price, confirmed_quantity, confirmed_brand, rfq_items(product_name, unit, brand)")
      .eq("order_id", order.id),
  ]);

  const supplier = recipient?.suppliers
    ? (Array.isArray(recipient.suppliers) ? recipient.suppliers[0] : recipient.suppliers) as { company_name: string; contact_name: string; email: string }
    : null;

  const fmt = (n: number | null | undefined): string => formatMoney(n, order.currency);

  const grandTotal = (orderItems ?? []).reduce((sum, item) => {
    const qty = item.confirmed_quantity ?? 0;
    const price = item.confirmed_unit_price ?? 0;
    return sum + qty * price;
  }, 0);

  return (
    <div className="p-8 max-w-3xl">
      {/* Back link */}
      <Link
        href={rfq ? `/rfq/${rfq.id}` : "/rfq"}
        className="inline-flex items-center gap-1.5 text-xs tracking-widest mb-6 transition-opacity hover:opacity-70"
        style={{ color: "#b0a49e", letterSpacing: "0.1em" }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        {rfq ? rfq.title.toUpperCase() : "TEKLİFLER"}
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest mb-3" style={{ color: "#7a6e67", letterSpacing: "0.12em" }}>
              SİPARİŞ · <span className="font-mono">SPR-{order.id.slice(0, 8).toUpperCase()}</span>
            </p>
            <h1 className="font-display text-5xl leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Sipariş <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>detayı.</em>
            </h1>
          </div>
          <div className="flex-shrink-0 mt-1">
            <StatusBadge status={order.status} />
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* RFQ */}
        <div className="rounded-xl px-5 py-4" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#b0a49e" }}>Teklif Talebi</p>
          {rfq ? (
            <Link href={`/rfq/${rfq.id}`} className="text-sm font-semibold hover:underline" style={{ color: "#111" }}>
              {rfq.title}
            </Link>
          ) : (
            <span className="text-sm" style={{ color: "#7a6e67" }}>—</span>
          )}
        </div>

        {/* Supplier */}
        <div className="rounded-xl px-5 py-4" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#b0a49e" }}>Tedarikçi</p>
          {supplier ? (
            <div>
              <div className="text-sm font-semibold" style={{ color: "#111" }}>{supplier.company_name}</div>
              {supplier.contact_name && (
                <div className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>{supplier.contact_name}</div>
              )}
              <div className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>{supplier.email}</div>
            </div>
          ) : (
            <span className="text-sm" style={{ color: "#7a6e67" }}>—</span>
          )}
        </div>

        {/* Amount */}
        <div className="rounded-xl px-5 py-4" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#b0a49e" }}>Onaylanan Tutar</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: "#111" }}>
            {fmt(order.confirmed_amount)}
          </p>
        </div>

        {/* Dates */}
        <div className="rounded-xl px-5 py-4" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#b0a49e" }}>Tarihler</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span style={{ color: "#7a6e67" }}>Oluşturuldu</span>
              <span className="tabular-nums" style={{ color: "#111" }}>{formatDate(order.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "#7a6e67" }}>Beklenen Teslimat</span>
              <span className="tabular-nums" style={{ color: "#111" }}>{formatDate(order.expected_delivery)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {(order.confirmation_note || order.buyer_note) && (
        <div className="rounded-xl px-5 py-4 mb-6" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "#b0a49e" }}>Notlar</p>
          <div className="space-y-4">
            {order.confirmation_note && (
              <div className="pl-4" style={{ borderLeft: "3px solid #e6ddd4" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#7a6e67" }}>PO Notu</p>
                <p className="text-sm leading-relaxed" style={{ color: "#111" }}>{order.confirmation_note}</p>
              </div>
            )}
            {order.buyer_note && (
              <div className="pl-4" style={{ borderLeft: "3px solid #e6ddd4" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#7a6e67" }}>Alıcı Notu</p>
                <p className="text-sm leading-relaxed" style={{ color: "#111" }}>{order.buyer_note}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <OrderActions orderId={order.id} status={order.status} />

      {/* Order items */}
      {orderItems && orderItems.length > 0 && (
        <div className="rounded-xl overflow-hidden mt-8" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          {/* Table header bar */}
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
            <Package className="w-4 h-4" style={{ color: "#7a6e67" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>
              Sipariş Kalemleri
            </span>
            <span
              className="ml-1 text-xs font-mono px-1.5 py-0.5 rounded-sm"
              style={{ background: "#e6ddd4", color: "#7a6e67" }}
            >
              {orderItems.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>ÜRÜN</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>MİKTAR</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>BİRİM FİYAT</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>TOPLAM</th>
                </tr>
              </thead>
              <tbody>
                {orderItems.map((item, idx) => {
                  const rfqItemRaw = item.rfq_items;
                  const rfqItem = (Array.isArray(rfqItemRaw) ? rfqItemRaw[0] : rfqItemRaw) as { product_name: string; unit: string; brand: string } | null;
                  const qty = item.confirmed_quantity ?? null;
                  const price = item.confirmed_unit_price ?? null;
                  const total = qty && price ? qty * price : null;
                  const isEven = idx % 2 === 0;

                  return (
                    <tr key={item.id} style={{ borderBottom: "1px solid #f0e8e0", background: isEven ? "#fff" : "#fdfaf7" }}>
                      <td className="px-5 py-4">
                        <div className="font-medium" style={{ color: "#111" }}>{rfqItem?.product_name ?? "—"}</div>
                        {(item.confirmed_brand || rfqItem?.brand) && (
                          <div className="text-xs mt-0.5" style={{ color: "#b0a49e" }}>
                            {item.confirmed_brand || rfqItem?.brand}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums" style={{ color: "#7a6e67" }}>
                        {qty != null ? `${qty} ${rfqItem?.unit ?? ""}`.trim() : "—"}
                      </td>
                      <td className="px-4 py-4 text-right tabular-nums" style={{ color: "#7a6e67" }}>
                        {fmt(price)}
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums font-semibold" style={{ color: "#111" }}>
                        {fmt(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Grand total row */}
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: "1px solid #e6ddd4", background: "#faf4ee" }}
            >
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>
                Genel Toplam
              </span>
              <span className="text-sm font-bold tabular-nums" style={{ color: "#111" }}>
                {fmt(grandTotal || order.confirmed_amount)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

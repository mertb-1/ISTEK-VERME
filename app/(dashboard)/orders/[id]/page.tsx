import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Package } from "lucide-react";
import OrderActions from "./OrderActions";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending_confirmation: { label: "Onay Bekliyor", bg: "#fef5e4", color: "#a06a00" },
  confirmed:           { label: "Onaylandı",     bg: "#edf8f1", color: "#1a7a3a" },
  completed:           { label: "Tamamlandı",    bg: "#edf8f1", color: "#1a7a3a" },
  cancelled:           { label: "İptal Edildi",  bg: "#fdf0ee", color: "#8b3a2a" },
};

function formatPrice(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("tr-TR");
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Verify ownership with RLS
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, confirmed_amount, expected_delivery, created_at, buyer_note, confirmation_note, rfq_id, rfq_recipient_id")
    .eq("id", params.id)
    .eq("buyer_id", user!.id)
    .single();

  if (!order) notFound();

  const admin = createAdminClient();

  // Fetch related data in parallel
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

  const statusCfg = STATUS_LABELS[order.status] ?? { label: order.status, bg: "#f5f0eb", color: "#7a6e67" };

  return (
    <div className="p-8 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-6">
        <Link href={rfq ? `/rfq/${rfq.id}` : "/rfq"} className="inline-flex items-center gap-1.5 text-xs tracking-widest transition-colors" style={{ color: "#b0a49e", letterSpacing: "0.1em" }}>
          <ArrowLeft className="w-3.5 h-3.5" />
          {rfq ? rfq.title.toUpperCase() : "TEKLİFLER"}
        </Link>
        <span className="text-xs" style={{ color: "#d0c8c0" }}>/</span>
        <span className="text-xs tracking-widest" style={{ color: "#7a6e67", letterSpacing: "0.1em" }}>
          SİPARİŞ
        </span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-xs font-mono" style={{ color: "#b0a49e" }}>
            SPR-{order.id.slice(0, 8).toUpperCase()}
          </span>
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: statusCfg.bg, color: statusCfg.color }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.color }} />
            {statusCfg.label}
          </span>
        </div>
        <h1 className="font-display text-4xl leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#111" }}>
          Sipariş <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>detayı.</em>
        </h1>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* RFQ */}
        <div className="rounded-xl px-5 py-4" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#b0a49e" }}>Teklif Talebi</div>
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
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#b0a49e" }}>Tedarikçi</div>
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
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#b0a49e" }}>Onaylanan Tutar</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: "#111" }}>
            {formatPrice(order.confirmed_amount)}
          </div>
        </div>

        {/* Dates */}
        <div className="rounded-xl px-5 py-4" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#b0a49e" }}>Tarihler</div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span style={{ color: "#7a6e67" }}>Oluşturuldu</span>
              <span style={{ color: "#111" }}>{formatDate(order.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "#7a6e67" }}>Beklenen Teslimat</span>
              <span style={{ color: "#111" }}>{formatDate(order.expected_delivery)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {(order.confirmation_note || order.buyer_note) && (
        <div className="rounded-xl px-5 py-4 mb-6" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#b0a49e" }}>Notlar</div>
          {order.confirmation_note && (
            <div className="mb-2">
              <div className="text-xs font-medium mb-1" style={{ color: "#7a6e67" }}>PO Notu</div>
              <p className="text-sm" style={{ color: "#111" }}>{order.confirmation_note}</p>
            </div>
          )}
          {order.buyer_note && (
            <div>
              <div className="text-xs font-medium mb-1" style={{ color: "#7a6e67" }}>Alıcı Notu</div>
              <p className="text-sm" style={{ color: "#111" }}>{order.buyer_note}</p>
            </div>
          )}
        </div>
      )}

      <OrderActions orderId={order.id} status={order.status} />

      {/* Order items */}
      {orderItems && orderItems.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
            <Package className="w-4 h-4" style={{ color: "#7a6e67" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>
              Sipariş Kalemleri · {orderItems.length} ürün
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
                <th className="text-left px-5 py-3 font-medium" style={{ color: "#7a6e67" }}>Ürün</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: "#7a6e67" }}>Miktar</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: "#7a6e67" }}>Birim Fiyat</th>
                <th className="text-right px-5 py-3 font-medium" style={{ color: "#7a6e67" }}>Toplam</th>
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
                  <tr key={item.id} style={{ borderBottom: "1px solid #f0e8e0", background: isEven ? "#fff" : "#faf4ee" }}>
                    <td className="px-5 py-3">
                      <div className="font-medium" style={{ color: "#111" }}>{rfqItem?.product_name ?? "—"}</div>
                      {(item.confirmed_brand || rfqItem?.brand) && (
                        <div className="text-xs mt-0.5" style={{ color: "#b0a49e" }}>
                          {item.confirmed_brand || rfqItem?.brand}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums" style={{ color: "#7a6e67" }}>
                      {qty != null ? `${qty} ${rfqItem?.unit ?? ""}`.trim() : "—"}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums" style={{ color: "#111" }}>
                      {formatPrice(price)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: "#111" }}>
                      {formatPrice(total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

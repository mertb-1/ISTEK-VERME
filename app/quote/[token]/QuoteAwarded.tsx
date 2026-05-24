import { CheckCircle, Package } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { formatMoney } from "@/lib/currency";

export type AwardedOrderItem = {
  id: string;
  productName: string;
  unit: string;
  confirmedBrand: string | null;
  confirmedQuantity: number | null;
  confirmedUnitPrice: number | null;
};

type Props = {
  buyerCompany: string;
  buyerLogoUrl?: string | null;
  rfqTitle: string;
  confirmedAmount?: number | null;
  expectedDelivery?: string | null;
  buyerNote?: string | null;
  supplierName?: string;
  orderItems?: AwardedOrderItem[];
  currency?: string;
};

export default function QuoteAwarded({
  buyerCompany,
  buyerLogoUrl,
  rfqTitle,
  confirmedAmount,
  expectedDelivery,
  buyerNote,
  supplierName,
  orderItems = [],
  currency = "USD",
}: Props) {
  const fmt = (n: number | null | undefined): string => formatMoney(n, currency);
  const deliveryText = expectedDelivery
    ? new Date(expectedDelivery).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const hasItems = orderItems.length > 0;
  const hasExtraDetails = deliveryText || buyerNote;

  return (
    <div className="min-h-screen" style={{ background: "#faf4ee" }}>
      {/* Combined black header with buyer identity */}
      <div style={{ background: "#111" }}>
        <div className="max-w-3xl mx-auto px-4 py-5">
          {/* Buyer identity row */}
          <div className="flex items-center gap-3 mb-4">
            {buyerLogoUrl ? (
              <div
                className="flex-shrink-0 flex items-center justify-center rounded overflow-hidden"
                style={{ width: 36, height: 36, background: "rgba(255,255,255,0.92)", padding: 3 }}
              >
                <img src={buyerLogoUrl} alt={buyerCompany} className="w-full h-full object-contain" />
              </div>
            ) : (
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
              >
                {buyerCompany.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>
              {buyerCompany}
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>·</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{APP_NAME}</span>
          </div>

          {/* RFQ title */}
          <p className="text-xs tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em" }}>
            TEKLİF TALEBİ
          </p>
          <h1 className="text-xl font-semibold text-white leading-snug">{rfqTitle}</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Success banner */}
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <div className="px-6 py-8 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "#edf8f1" }}
            >
              <CheckCircle className="w-7 h-7" style={{ color: "#1a7a3a" }} />
            </div>
            <h2
              className="text-2xl font-semibold mb-2"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#111" }}
            >
              Teklifiniz <em style={{ color: "#1a7a3a" }}>onaylandı!</em>
            </h2>
            <p className="text-sm" style={{ color: "#7a6e67" }}>
              {buyerCompany} firması teklifinizi sipariş olarak onaylamıştır.
              {supplierName ? ` Sayın ${supplierName}, tebrikler!` : ""}
            </p>
          </div>

          {/* Delivery date + buyer note — only if present, never the amount (shown in table) */}
          {hasExtraDetails && (
            <div className="px-6 pb-5 space-y-3" style={{ borderTop: "1px solid #e6ddd4", paddingTop: "1.25rem" }}>
              {deliveryText && (
                <div
                  className="flex justify-between items-center py-2"
                  style={{ borderBottom: buyerNote ? "1px solid #f0e8e0" : undefined }}
                >
                  <span className="text-sm" style={{ color: "#7a6e67" }}>Teslim Tarihi</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "#111" }}>{deliveryText}</span>
                </div>
              )}
              {buyerNote && (
                <div className="py-2">
                  <span className="text-xs font-medium block mb-1" style={{ color: "#7a6e67" }}>Alıcı Notu</span>
                  <p
                    className="text-sm leading-relaxed px-3 py-2 rounded-lg"
                    style={{ background: "#faf4ee", color: "#111" }}
                  >
                    {buyerNote}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="px-6 py-4" style={{ borderTop: "1px solid #f0e8e0", background: "#faf4ee" }}>
            <p className="text-xs text-center" style={{ color: "#b0a49e" }}>
              Sipariş detayları için {buyerCompany} firmasıyla iletişime geçebilirsiniz.
            </p>
          </div>
        </div>

        {/* Order items table */}
        {hasItems && (
          <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
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
                    const qty = item.confirmedQuantity;
                    const price = item.confirmedUnitPrice;
                    const total = qty != null && price != null ? qty * price : null;
                    const isEven = idx % 2 === 0;

                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f0e8e0", background: isEven ? "#fff" : "#fdfaf7" }}>
                        <td className="px-5 py-4">
                          <div className="font-medium" style={{ color: "#111" }}>{item.productName || "—"}</div>
                          {item.confirmedBrand && (
                            <div className="text-xs mt-0.5" style={{ color: "#b0a49e" }}>{item.confirmedBrand}</div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums" style={{ color: "#7a6e67" }}>
                          {qty != null ? `${qty} ${item.unit}`.trim() : "—"}
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

              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: "1px solid #e6ddd4", background: "#faf4ee" }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>
                  Genel Toplam
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color: "#111" }}>
                  {fmt(confirmedAmount ?? orderItems.reduce((s, i) => {
                    const q = i.confirmedQuantity ?? 0;
                    const p = i.confirmedUnitPrice ?? 0;
                    return s + q * p;
                  }, 0))}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

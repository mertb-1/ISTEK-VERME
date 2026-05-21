import { CheckCircle } from "lucide-react";
import { APP_NAME } from "@/lib/config";

type Props = {
  buyerCompany: string;
  buyerLogoUrl?: string | null;
  rfqTitle: string;
  confirmedAmount?: number | null;
  expectedDelivery?: string | null;
  buyerNote?: string | null;
  supplierName?: string;
};

export default function QuoteAwarded({
  buyerCompany,
  buyerLogoUrl,
  rfqTitle,
  confirmedAmount,
  expectedDelivery,
  buyerNote,
  supplierName,
}: Props) {
  const deliveryText = expectedDelivery
    ? new Date(expectedDelivery).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const amountText =
    confirmedAmount != null
      ? Number(confirmedAmount).toLocaleString("tr-TR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;

  return (
    <div className="min-h-screen" style={{ background: "#faf4ee" }}>
      {/* Buyer identity bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e6ddd4" }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col items-center gap-1">
          {buyerLogoUrl ? (
            <img
              src={buyerLogoUrl}
              alt={buyerCompany}
              className="h-10 object-contain"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: "#8b3a2a" }}
            >
              {buyerCompany.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
          )}
          <p className="text-xs" style={{ color: "#7a6e67" }}>
            <strong style={{ color: "#111" }}>{buyerCompany}</strong> · {APP_NAME}
          </p>
        </div>
      </div>

      {/* RFQ info header */}
      <div style={{ background: "#111" }}>
        <div className="max-w-3xl mx-auto px-4 py-5">
          <p className="text-xs tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>
            {APP_NAME} · TEKLİF TALEBİ
          </p>
          <h1 className="text-xl font-semibold text-white leading-snug">{rfqTitle}</h1>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            Alıcı: <span style={{ color: "rgba(255,255,255,0.85)" }}>{buyerCompany}</span>
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          {/* Success banner */}
          <div className="px-6 py-8 text-center" style={{ borderBottom: (amountText || deliveryText || buyerNote) ? "1px solid #e6ddd4" : undefined }}>
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

          {/* Order details */}
          {(amountText || deliveryText || buyerNote) && (
            <div className="px-6 py-5 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#b0a49e" }}>
                Sipariş Detayları
              </p>
              {amountText && (
                <div className="flex justify-between items-center py-2" style={{ borderBottom: "1px solid #f0e8e0" }}>
                  <span className="text-sm" style={{ color: "#7a6e67" }}>Onaylanan Tutar</span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: "#111" }}>{amountText}</span>
                </div>
              )}
              {deliveryText && (
                <div className="flex justify-between items-center py-2" style={{ borderBottom: buyerNote ? "1px solid #f0e8e0" : undefined }}>
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
      </div>
    </div>
  );
}

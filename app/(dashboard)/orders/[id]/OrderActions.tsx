"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const canComplete = status === "confirmed";
  const canCancel   = status === "confirmed" || status === "pending_confirmation";

  if (!canComplete && !canCancel) return null;

  async function updateStatus(newStatus: string, cancellation_reason?: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, cancellation_reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Bir hata oluştu.");
        return;
      }
      toast.success(newStatus === "completed" ? "Sipariş tamamlandı." : "Sipariş iptal edildi.");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleCancelConfirm() {
    setShowCancelDialog(false);
    updateStatus("cancelled", cancelReason);
  }

  return (
    <>
      <div
        className="rounded-xl px-5 py-4 mb-6 flex items-center gap-3"
        style={{ background: "#fff", border: "1px solid #e6ddd4" }}
      >
        <p className="text-xs font-semibold uppercase tracking-wider flex-1" style={{ color: "#b0a49e" }}>
          İşlemler
        </p>

        {canComplete && (
          <button
            disabled={loading}
            onClick={() => updateStatus("completed")}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-opacity disabled:opacity-50 hover:opacity-90"
            style={{ background: "#1a7a3a", color: "#fff" }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Tamamlandı İşaretle
          </button>
        )}

        {canCancel && (
          <button
            disabled={loading}
            onClick={() => { setCancelReason(""); setShowCancelDialog(true); }}
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-opacity disabled:opacity-50 hover:opacity-90"
            style={{ background: "#fdf0ee", color: "#8b3a2a", border: "1px solid #f5d0c8" }}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            İptal Et
          </button>
        )}
      </div>

      {showCancelDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCancelDialog(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-xl"
            style={{ background: "#fff", border: "1px solid #e6ddd4" }}
          >
            <h2
              className="text-lg font-bold mb-1"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#111" }}
            >
              Siparişi İptal Et
            </h2>
            <p className="text-sm mb-5" style={{ color: "#7a6e67" }}>
              Bu işlem geri alınamaz. Tedarikçiye iptal bildirimi maili gönderilecektir.
            </p>

            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: "#7a6e67" }}
            >
              İptal Nedeni <span style={{ color: "#b0a49e", fontWeight: 400, textTransform: "none" }}>(isteğe bağlı)</span>
            </label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Örn: Ürün temin edilemedi, alternatif tedarikçi ile ilerlenecek."
              className="w-full rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#d4c5b8]"
              style={{
                border: "1px solid #e6ddd4",
                padding: "10px 12px",
                color: "#111",
                background: "#faf4ee",
              }}
            />

            <div className="flex gap-3 mt-5 justify-end">
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
                className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#7a6e67" }}
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg"
                style={{ background: "#8b3a2a", color: "#fff" }}
              >
                <XCircle className="w-4 h-4" />
                Evet, İptal Et
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

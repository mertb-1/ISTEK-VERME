"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const canComplete = status === "confirmed";
  const canCancel   = status === "confirmed" || status === "pending_confirmation";

  if (!canComplete && !canCancel) return null;

  async function updateStatus(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
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

  function handleCancel() {
    if (!confirm("Siparişi iptal etmek istediğinizden emin misiniz?")) return;
    updateStatus("cancelled");
  }

  return (
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
          onClick={handleCancel}
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
  );
}

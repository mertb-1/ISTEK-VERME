"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

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
    <div className="flex items-center gap-3 mt-6">
      {canComplete && (
        <button
          disabled={loading}
          onClick={() => updateStatus("completed")}
          className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: "#1a7a3a", color: "#fff" }}
        >
          Tamamlandı İşaretle
        </button>
      )}
      {canCancel && (
        <button
          disabled={loading}
          onClick={handleCancel}
          className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          style={{ background: "#fdf0ee", color: "#8b3a2a", border: "1px solid #f5d0c8" }}
        >
          İptal Et
        </button>
      )}
    </div>
  );
}

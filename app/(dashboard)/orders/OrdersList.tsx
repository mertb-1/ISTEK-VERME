"use client";

import { useState } from "react";
import Link from "next/link";

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending_confirmation: { label: "Onay Bekliyor", bg: "#fef5e4", color: "#a06a00" },
  confirmed:            { label: "Onaylandı",     bg: "#edf8f1", color: "#1a7a3a" },
  completed:            { label: "Tamamlandı",    bg: "#edf8f1", color: "#1a7a3a" },
  cancelled:            { label: "İptal Edildi",  bg: "#fdf0ee", color: "#8b3a2a" },
};

type Tab = "all" | "current" | "completed" | "cancelled";

const TABS: { key: Tab; label: string }[] = [
  { key: "all",       label: "Tümü" },
  { key: "current",   label: "Aktif" },
  { key: "completed", label: "Tamamlandı" },
  { key: "cancelled", label: "İptal" },
];

const CURRENT_STATUSES = new Set(["pending_confirmation", "confirmed"]);

function formatPrice(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("tr-TR");
}

export type OrderRow = {
  id: string;
  status: string;
  confirmed_amount: number | null;
  expected_delivery: string | null;
  created_at: string;
  rfq_title: string | null;
  rfq_id: string | null;
  supplier_name: string | null;
};

export default function OrdersList({ orders }: { orders: OrderRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (o.rfq_title?.toLowerCase().includes(q) ?? false) ||
      (o.supplier_name?.toLowerCase().includes(q) ?? false) ||
      `spr-${o.id.slice(0, 8)}`.includes(q);
    let matchesTab = true;
    if (tab === "current")   matchesTab = CURRENT_STATUSES.has(o.status);
    if (tab === "completed")  matchesTab = o.status === "completed";
    if (tab === "cancelled")  matchesTab = o.status === "cancelled";
    return matchesSearch && matchesTab;
  });

  const counts: Record<Tab, number> = {
    all:       orders.length,
    current:   orders.filter((o) => CURRENT_STATUSES.has(o.status)).length,
    completed: orders.filter((o) => o.status === "completed").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  return (
    <>
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="RFQ veya tedarikçi ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 text-sm px-4 py-2.5 rounded-lg outline-none"
          style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
            style={{
              background: tab === t.key ? "#111" : "#fff",
              color: tab === t.key ? "#fff" : "#7a6e67",
              border: "1px solid",
              borderColor: tab === t.key ? "#111" : "#e6ddd4",
            }}
          >
            {t.label}
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                background: tab === t.key ? "rgba(255,255,255,0.2)" : "#f0e8e0",
                color: tab === t.key ? "#fff" : "#7a6e67",
              }}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl px-6 py-16 text-center" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <p className="text-sm" style={{ color: "#7a6e67" }}>
            {orders.length === 0 ? "Henüz sipariş bulunmuyor." : "Bu filtreye uyan sipariş yok."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e6ddd4" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}>
                <th className="text-left px-5 py-3 font-semibold text-xs tracking-wider uppercase" style={{ color: "#7a6e67" }}>Ref</th>
                <th className="text-left px-5 py-3 font-semibold text-xs tracking-wider uppercase" style={{ color: "#7a6e67" }}>Teklif Talebi</th>
                <th className="text-left px-5 py-3 font-semibold text-xs tracking-wider uppercase" style={{ color: "#7a6e67" }}>Tedarikçi</th>
                <th className="text-right px-5 py-3 font-semibold text-xs tracking-wider uppercase" style={{ color: "#7a6e67" }}>Tutar</th>
                <th className="text-left px-5 py-3 font-semibold text-xs tracking-wider uppercase" style={{ color: "#7a6e67" }}>Durum</th>
                <th className="text-left px-5 py-3 font-semibold text-xs tracking-wider uppercase" style={{ color: "#7a6e67" }}>Oluşturuldu</th>
                <th className="text-left px-5 py-3 font-semibold text-xs tracking-wider uppercase" style={{ color: "#7a6e67" }}>Teslim</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order, idx) => {
                const statusCfg = STATUS_LABELS[order.status] ?? { label: order.status, bg: "#f5f0eb", color: "#7a6e67" };
                const isEven = idx % 2 === 0;
                return (
                  <Link key={order.id} href={`/orders/${order.id}`} legacyBehavior>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-orange-50"
                      style={{ background: isEven ? "#fff" : "#faf4ee", borderBottom: "1px solid #f0e8e0" }}
                    >
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: "#b0a49e" }}>
                        SPR-{order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-5 py-3 font-medium max-w-[200px] truncate" style={{ color: "#111" }}>
                        {order.rfq_title ?? "—"}
                      </td>
                      <td className="px-5 py-3" style={{ color: "#7a6e67" }}>
                        {order.supplier_name ?? "—"}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold" style={{ color: "#111" }}>
                        {formatPrice(order.confirmed_amount)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
                          style={{ background: statusCfg.bg, color: statusCfg.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusCfg.color }} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3" style={{ color: "#7a6e67" }}>
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-5 py-3" style={{ color: "#7a6e67" }}>
                        {formatDate(order.expected_delivery)}
                      </td>
                    </tr>
                  </Link>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

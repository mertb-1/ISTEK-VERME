"use client";

import { useState } from "react";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";

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
    if (tab === "completed") matchesTab = o.status === "completed";
    if (tab === "cancelled") matchesTab = o.status === "cancelled";
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
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <Input
          type="text"
          placeholder="RFQ veya tedarikçi ara…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 text-sm"
          style={{ borderColor: "#e6ddd4", background: "#fff" }}
        />

        <div
          className="flex items-center gap-1 rounded-lg p-1"
          style={{ background: "#f5f0eb", border: "1px solid #e6ddd4" }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all"
              style={
                tab === t.key
                  ? { background: "#111", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }
                  : { background: "transparent", color: "#7a6e67" }
              }
            >
              {t.label}
              <span
                className="text-xs px-1.5 py-0.5 rounded-sm font-mono leading-none"
                style={
                  tab === t.key
                    ? { background: "rgba(255,255,255,0.18)", color: "#fff" }
                    : { background: "#e6ddd4", color: "#7a6e67" }
                }
              >
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table container */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
        {filtered.length === 0 ? (
          orders.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Henüz sipariş bulunmuyor"
              description="Teklif taleplerini değerlendirip bir tedarikçi seçtiğinizde siparişler burada görünür."
            />
          ) : (
            <EmptyState
              icon={ShoppingBag}
              title="Sonuç bulunamadı"
              description="Arama veya filtre kriterlerini değiştirmeyi deneyin."
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>REF</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>TEKLİF TALEBİ</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>TEDARİKÇİ</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>TUTAR</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>DURUM</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>TESLİM</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>TARİH</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((order, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={order.id}
                      className="group transition-colors"
                      style={{
                        borderBottom: "1px solid #f0e8e0",
                        background: isEven ? "#fff" : "#fdfaf7",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#fef5e4"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isEven ? "#fff" : "#fdfaf7"; }}
                    >
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono" style={{ color: "#b0a49e" }}>
                          SPR-{order.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-medium leading-snug hover:underline"
                          style={{ color: "#111" }}
                        >
                          {order.rfq_title ?? "—"}
                        </Link>
                      </td>

                      <td className="px-4 py-4 text-sm" style={{ color: "#7a6e67" }}>
                        {order.supplier_name ?? "—"}
                      </td>

                      <td className="px-4 py-4 text-right tabular-nums font-semibold" style={{ color: "#111" }}>
                        {formatPrice(order.confirmed_amount)}
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={order.status} />
                      </td>

                      <td className="px-5 py-4 text-right text-xs tabular-nums" style={{ color: "#b0a49e" }}>
                        {formatDate(order.expected_delivery)}
                      </td>

                      <td className="px-5 py-4 text-right text-xs tabular-nums" style={{ color: "#b0a49e" }}>
                        {formatDate(order.created_at)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <Link href={`/orders/${order.id}`} tabIndex={-1} aria-hidden>
                          <ArrowRight
                            className="w-4 h-4 ml-auto transition-transform group-hover:translate-x-0.5"
                            style={{ color: "#d0c8c0" }}
                          />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="px-5 py-3" style={{ borderTop: "1px solid #f0e8e0" }}>
              <p className="text-xs" style={{ color: "#b0a49e" }}>
                {filtered.length} kayıt gösteriliyor
                {filtered.length !== orders.length && ` (toplam ${orders.length})`}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";

export type RfqRow = {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  created_at: string;
  awarded_recipient_id: string | null;
  recipient_count: number;
  item_count: number;
};

type Tab = "all" | "open" | "closed" | "awarded";

const TABS: { key: Tab; label: string }[] = [
  { key: "all",     label: "Tümü" },
  { key: "open",    label: "Açık" },
  { key: "closed",  label: "Kapalı" },
  { key: "awarded", label: "Siparişe Çevrildi" },
];

function getRfqStatus(rfq: RfqRow): string {
  if (rfq.awarded_recipient_id) return "awarded";
  return rfq.status;
}

export default function RfqList({ rfqs }: { rfqs: RfqRow[] }) {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");

  const filtered = rfqs.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || r.title.toLowerCase().includes(q) || `tkf-${r.id.slice(0, 8)}`.includes(q);
    let matchesTab = true;
    if (tab === "open")    matchesTab = r.status === "open" && !r.awarded_recipient_id;
    if (tab === "closed")  matchesTab = r.status === "closed" && !r.awarded_recipient_id;
    if (tab === "awarded") matchesTab = !!r.awarded_recipient_id;
    return matchesSearch && matchesTab;
  });

  const counts: Record<Tab, number> = {
    all:     rfqs.length,
    open:    rfqs.filter((r) => r.status === "open" && !r.awarded_recipient_id).length,
    closed:  rfqs.filter((r) => r.status === "closed" && !r.awarded_recipient_id).length,
    awarded: rfqs.filter((r) => !!r.awarded_recipient_id).length,
  };

  return (
    <>
      {/* Toolbar: search + tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <Input
          type="text"
          placeholder="Teklif talebi ara…"
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
          rfqs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Henüz teklif talebi oluşturmadınız"
              description="İlk teklif talebinizi oluşturun ve tedarikçilerinize gönderin."
            >
              <Link
                href="/rfq/new"
                className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded"
                style={{ background: "#111", color: "#fff" }}
              >
                + İlk Teklif Talebini Oluştur
              </Link>
            </EmptyState>
          ) : (
            <EmptyState
              icon={FileText}
              title="Sonuç bulunamadı"
              description="Arama veya filtre kriterlerini değiştirmeyi deneyin."
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
                  <th className="text-left px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    KOD
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    BAŞLIK
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    DURUM
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    KALEM
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    TEDARİKÇİ
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    SON TARİH
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    TARİH
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((rfq, idx) => {
                  const deadline = rfq.deadline ? new Date(rfq.deadline) : null;
                  const isOpen = rfq.status === "open" && !rfq.awarded_recipient_id;
                  const isOverdue = deadline && deadline < new Date() && isOpen;
                  const isEven = idx % 2 === 0;

                  return (
                    <tr
                      key={rfq.id}
                      className="group transition-colors"
                      style={{
                        borderBottom: "1px solid #f0e8e0",
                        background: isEven ? "#fff" : "#fdfaf7",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#fef5e4"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = isEven ? "#fff" : "#fdfaf7"; }}
                    >
                      {/* Code */}
                      <td className="px-5 py-4">
                        <span className="text-xs font-mono" style={{ color: "#b0a49e" }}>
                          TKF-{rfq.id.slice(0, 8).toUpperCase()}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/rfq/${rfq.id}`}
                          className="font-medium leading-snug hover:underline"
                          style={{ color: "#111" }}
                        >
                          {rfq.title}
                        </Link>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <StatusBadge
                          status={getRfqStatus(rfq)}
                          label={rfq.awarded_recipient_id ? "Siparişe Çevrildi" : undefined}
                        />
                      </td>

                      {/* Items */}
                      <td className="px-4 py-4 text-right tabular-nums" style={{ color: "#7a6e67" }}>
                        {rfq.item_count}
                      </td>

                      {/* Suppliers */}
                      <td className="px-4 py-4 text-right tabular-nums" style={{ color: "#7a6e67" }}>
                        {rfq.recipient_count}
                      </td>

                      {/* Deadline */}
                      <td className="px-5 py-4 text-right">
                        {deadline ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            style={{ color: isOverdue ? "#c0392b" : "#b0a49e" }}
                          >
                            {isOverdue && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                            {deadline.toLocaleDateString("tr-TR")}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "#d0c8c0" }}>—</span>
                        )}
                      </td>

                      {/* Created */}
                      <td className="px-5 py-4 text-right text-xs tabular-nums" style={{ color: "#b0a49e" }}>
                        {new Date(rfq.created_at).toLocaleDateString("tr-TR")}
                      </td>

                      {/* Arrow */}
                      <td className="px-4 py-4 text-right">
                        <Link href={`/rfq/${rfq.id}`} tabIndex={-1} aria-hidden>
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
                {filtered.length !== rfqs.length && ` (toplam ${rfqs.length})`}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

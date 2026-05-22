"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, ArrowRight, Search } from "lucide-react";
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

type Tab = "open" | "closed" | "awarded" | "all";

const TABS: { key: Tab; label: string }[] = [
  { key: "open",    label: "Açık" },
  { key: "closed",  label: "Kapalı" },
  { key: "awarded", label: "Siparişe Çevrildi" },
  { key: "all",     label: "Tümü" },
];

function getRfqStatus(rfq: RfqRow): string {
  if (rfq.awarded_recipient_id) return "awarded";
  return rfq.status;
}

export default function RfqList({ rfqs }: { rfqs: RfqRow[] }) {
  const [tab, setTab] = useState<Tab>("open");
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
    open:    rfqs.filter((r) => r.status === "open" && !r.awarded_recipient_id).length,
    closed:  rfqs.filter((r) => r.status === "closed" && !r.awarded_recipient_id).length,
    awarded: rfqs.filter((r) => !!r.awarded_recipient_id).length,
    all:     rfqs.length,
  };

  return (
    <>
      {/* Toolbar: tabs left, search right */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div
          className="flex items-center gap-1 rounded-lg p-1 self-start"
          style={{ background: "#f5f0eb", border: "1px solid #e6ddd4" }}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-all whitespace-nowrap"
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

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "#b0a49e" }} />
          <input
            type="text"
            placeholder="Teklif talebi ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-sm pl-9 pr-3 py-2 rounded-lg outline-none transition-shadow focus:ring-2"
            style={{
              border: "1px solid #e6ddd4",
              background: "#fff",
              color: "#111",
              fontSize: "13px",
            }}
          />
        </div>
      </div>

      {/* Table */}
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
                    TALEP
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    TEDARİKÇİ
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    TERMİN
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>
                    DURUM
                  </th>
                  <th className="px-4 py-3 w-8" />
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
                      {/* Talep: title + code + item count */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/rfq/${rfq.id}`}
                          className="block hover:underline font-medium leading-snug"
                          style={{ color: "#111" }}
                        >
                          {rfq.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono" style={{ color: "#b0a49e" }}>
                            TKF-{rfq.id.slice(0, 8).toUpperCase()}
                          </span>
                          {rfq.item_count > 0 && (
                            <span className="text-xs" style={{ color: "#b0a49e" }}>
                              · {rfq.item_count} kalem
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tedarikçi count */}
                      <td className="px-4 py-4 text-center">
                        <span
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold tabular-nums"
                          style={{ background: rfq.recipient_count > 0 ? "#f0e9e2" : "#f5f5f4", color: rfq.recipient_count > 0 ? "#8b3a2a" : "#b0a49e" }}
                        >
                          {rfq.recipient_count}
                        </span>
                      </td>

                      {/* Termin */}
                      <td className="px-4 py-4">
                        {deadline ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs"
                            style={{ color: isOverdue ? "#c0392b" : "#7a6e67" }}
                          >
                            {isOverdue && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
                            {deadline.toLocaleDateString("tr-TR")}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "#d0c8c0" }}>—</span>
                        )}
                      </td>

                      {/* Durum */}
                      <td className="px-4 py-4">
                        <StatusBadge
                          status={getRfqStatus(rfq)}
                          label={rfq.awarded_recipient_id ? "Siparişe Çevrildi" : undefined}
                        />
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

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

function StatusBadge({ rfq }: { rfq: RfqRow }) {
  if (rfq.awarded_recipient_id) {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded" style={{ background: "#edf8f1", color: "#1a7a3a" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#1a7a3a" }} />
        Siparişe Çevrildi
      </span>
    );
  }
  if (rfq.status === "open") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded" style={{ background: "#fdf0ee", color: "#8b3a2a" }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#c0392b" }} />
        Açık
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#aaa" }} />
      Kapalı
    </span>
  );
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
      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Teklif talebi ara…"
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

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-xl px-6 py-16 text-center" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <p className="text-sm mb-4" style={{ color: "#7a6e67" }}>
            {rfqs.length === 0
              ? "Henüz teklif talebi oluşturmadınız."
              : "Bu filtreye uyan teklif talebi yok."}
          </p>
          {rfqs.length === 0 && (
            <Link
              href="/rfq/new"
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded"
              style={{ background: "#111", color: "#fff" }}
            >
              + İlk Teklif Talebini Oluştur
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((rfq) => {
            const deadline = rfq.deadline ? new Date(rfq.deadline) : null;
            const isOpen = rfq.status === "open";
            const isOverdue = deadline && deadline < new Date() && isOpen;

            return (
              <Link
                key={rfq.id}
                href={`/rfq/${rfq.id}`}
                className="block rounded-xl p-5 transition-all hover:border-orange-800"
                style={{ background: "#fff", border: "1px solid #e6ddd4" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-mono" style={{ color: "#b0a49e" }}>
                    TKF-{rfq.id.slice(0, 8).toUpperCase()}
                  </span>
                  <StatusBadge rfq={rfq} />
                </div>

                <h3 className="font-semibold text-base mb-3 leading-snug" style={{ color: "#111" }}>
                  {rfq.title}
                </h3>

                {/* Progress bar */}
                <div className="w-full h-1 rounded-full mb-3 overflow-hidden" style={{ background: "#f0e8e0" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: rfq.recipient_count > 0
                        ? `${Math.min(100, (rfq.recipient_count / Math.max(rfq.recipient_count, 6)) * 100)}%`
                        : "0%",
                      background: rfq.awarded_recipient_id ? "#1a7a3a" : isOpen ? "#8b3a2a" : "#aaa",
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs" style={{ color: "#7a6e67" }}>
                  <span>
                    {rfq.item_count} kalem · {rfq.recipient_count} tedarikçi
                  </span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: "#b0a49e" }}>
                      {new Date(rfq.created_at).toLocaleDateString("tr-TR")}
                    </span>
                    {deadline && (
                      <span className="flex items-center gap-1" style={{ color: isOverdue ? "#c0392b" : "#b0a49e" }}>
                        {isOverdue && <AlertTriangle className="w-3 h-3" />}
                        {deadline.toLocaleDateString("tr-TR")}
                      </span>
                    )}
                    <span className="font-medium" style={{ color: "#111" }}>İncele →</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

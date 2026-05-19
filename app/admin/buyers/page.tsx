"use client";

import { useEffect, useState } from "react";

type Buyer = {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const pending = (buyers: Buyer[]) => buyers.filter(b => b.status === "pending");
const approved = (buyers: Buyer[]) => buyers.filter(b => b.status === "approved");
const rejected = (buyers: Buyer[]) => buyers.filter(b => b.status === "rejected");

export default function AdminBuyersPage() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  const fetchBuyers = async () => {
    const res = await fetch("/api/admin/buyers");
    if (res.ok) setBuyers(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchBuyers(); }, []);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(id);
    await fetch("/api/admin/buyers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    await fetchBuyers();
    setUpdating(null);
  };

  const tabList: { key: "pending" | "approved" | "rejected"; label: string; count: number }[] = [
    { key: "pending",  label: "Onay bekleyen", count: pending(buyers).length },
    { key: "approved", label: "Onaylı",         count: approved(buyers).length },
    { key: "rejected", label: "Reddedilen",     count: rejected(buyers).length },
  ];

  const visible = buyers.filter(b => b.status === tab);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm" style={{ color: "#7a6e67" }}>Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Heading */}
      <div className="mb-8">
        <p className="text-xs tracking-widest mb-3" style={{ color: "#7a6e67", letterSpacing: "0.12em" }}>
          ADMIN · ALICI ONAY
        </p>
        <h1 className="font-display text-5xl leading-tight mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Yöneticiler<em style={{ color: "#8b3a2a", fontStyle: "italic" }}>.</em>
        </h1>
        <p className="text-sm" style={{ color: "#7a6e67" }}>
          Yeni başvuruları inceleyin. Onaylanan alıcılar sisteme tam erişim kazanır; reddedilenlere bilgilendirme maili gider.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "ONAY BEKLEYEN", value: pending(buyers).length },
          { label: "ONAYLI ALICI",  value: approved(buyers).length },
          { label: "REDDEDİLEN",   value: rejected(buyers).length },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5"
            style={{ background: "#fff", border: "1px solid #e6ddd4" }}
          >
            <p className="text-xs tracking-widest mb-2" style={{ color: "#7a6e67", letterSpacing: "0.1em" }}>
              {card.label}
            </p>
            <p className="font-display text-4xl font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#111" }}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 mb-4" style={{ borderBottom: "1px solid #e6ddd4" }}>
        {tabList.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="text-sm font-medium px-4 py-2.5 transition-colors"
            style={{
              color: tab === t.key ? "#111" : "#7a6e67",
              borderBottom: tab === t.key ? "2px solid #111" : "2px solid transparent",
              marginBottom: "-1px",
            }}
          >
            {t.label} {t.count > 0 && <span className="ml-1 text-xs">{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Buyer list */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
        {visible.length === 0 ? (
          <div className="p-12 text-center text-sm" style={{ color: "#7a6e67" }}>Bu kategoride kayıt yok.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: "#e6ddd4" }}>
            {visible.map((buyer) => {
              const initials = (buyer.company_name || buyer.full_name).split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={buyer.id} className="flex items-center gap-4 px-6 py-4">
                  {/* Avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background: "#f5ede6", color: "#8b3a2a" }}
                  >
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm" style={{ color: "#111" }}>{buyer.company_name || buyer.full_name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>
                      {buyer.email} · başvuru {new Date(buyer.created_at).toLocaleDateString("tr-TR")}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0">
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded"
                      style={{
                        background: buyer.status === "pending" ? "#fef5e4" : buyer.status === "approved" ? "#edf8f1" : "#fdf0ee",
                        color: buyer.status === "pending" ? "#a06a00" : buyer.status === "approved" ? "#1a7a3a" : "#8b3a2a",
                      }}
                    >
                      {buyer.status === "pending" ? "İncelemede" : buyer.status === "approved" ? "Onaylı" : "Reddedildi"}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {buyer.status !== "rejected" && (
                      <button
                        onClick={() => updateStatus(buyer.id, "rejected")}
                        disabled={updating === buyer.id}
                        className="text-xs font-medium px-3 py-1.5 rounded border transition-colors disabled:opacity-50"
                        style={{ borderColor: "#e6ddd4", color: "#7a6e67" }}
                      >
                        Reddet
                      </button>
                    )}
                    {buyer.status !== "approved" && (
                      <button
                        onClick={() => updateStatus(buyer.id, "approved")}
                        disabled={updating === buyer.id}
                        className="text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1 disabled:opacity-50"
                        style={{ background: "#111", color: "#fff" }}
                      >
                        ✓ Onayla
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

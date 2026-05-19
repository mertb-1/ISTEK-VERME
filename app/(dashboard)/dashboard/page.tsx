import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ArrowRight, AlertTriangle } from "lucide-react";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  const [{ count: rfqCount }, { count: supplierCount }, { data: recentRfqs }, { data: buyer }, { data: buyerRfqIds }] =
    await Promise.all([
      supabase.from("rfqs").select("*", { count: "exact", head: true }).eq("buyer_id", user!.id),
      supabase.from("suppliers").select("*", { count: "exact", head: true }).eq("buyer_id", user!.id),
      supabase.from("rfqs").select("id, title, status, created_at, deadline").eq("buyer_id", user!.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("buyers").select("company_name, full_name").eq("id", user!.id).single(),
      supabase.from("rfqs").select("id").eq("buyer_id", user!.id),
    ]);

  const rfqIdList = (buyerRfqIds ?? []).map((r: { id: string }) => r.id);
  const { count: awaitingCount } = rfqIdList.length > 0
    ? await admin.from("rfq_recipients").select("id", { count: "exact", head: true }).eq("status", "sent").in("rfq_id", rfqIdList)
    : { count: 0 };

  const companyName = buyer?.company_name || buyer?.full_name || "Firma";
  const today = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  return (
    <div className="p-8 max-w-5xl">
      {/* Date + heading */}
      <div className="mb-8">
        <p className="text-xs tracking-widest mb-3" style={{ color: "#7a6e67", letterSpacing: "0.12em" }}>
          {today}
        </p>
        <h1 className="font-display text-5xl leading-tight mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {companyName} <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>panosu.</em>
        </h1>
        <p className="text-sm" style={{ color: "#7a6e67" }}>
          {rfqCount ?? 0} teklif talebi oluşturuldu. Tedarikçi havuzunuz: {supplierCount ?? 0} firma.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "TOPLAM TEKLİF", value: rfqCount ?? 0, sub: "oluşturulan teklif talebi" },
          { label: "TEDARİKÇİ", value: supplierCount ?? 0, sub: "kayıtlı firma" },
          { label: "CEVAP BEKLEYEN", value: awaitingCount ?? 0, sub: "tedarikçi henüz yanıtlamadı" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl p-5"
            style={{ background: "#fff", border: "1px solid #e6ddd4" }}
          >
            <p className="text-xs tracking-widest mb-3" style={{ color: "#7a6e67", letterSpacing: "0.1em" }}>
              {card.label}
            </p>
            <p className="font-display text-4xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#111" }}>
              {card.value}
            </p>
            <p className="text-xs" style={{ color: "#b0a49e" }}>{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent Teklifler */}
      <div className="rounded-xl overflow-hidden mb-6" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #e6ddd4" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#111" }}>SON TEKLİF TALEPLERİ</h2>
          <Link href="/rfq" className="text-xs font-medium" style={{ color: "#7a6e67" }}>
            TÜMÜ →
          </Link>
        </div>

        {!recentRfqs || recentRfqs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm mb-4" style={{ color: "#7a6e67" }}>Henüz teklif talebi oluşturmadınız.</p>
            <Link
              href="/rfq/new"
              className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded"
              style={{ background: "#111", color: "#fff" }}
            >
              + Yeni Teklif
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y" style={{ borderColor: "#e6ddd4" }}>
              {recentRfqs.map((rfq) => {
                const isOpen = rfq.status === "open";
                const deadline = rfq.deadline ? new Date(rfq.deadline) : null;
                const isOverdue = deadline && deadline < new Date() && isOpen;
                return (
                  <li key={rfq.id}>
                    <Link
                      href={`/rfq/${rfq.id}`}
                      className="flex items-center justify-between px-6 py-4 transition-colors group hover:bg-amber-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: isOpen ? "#c0392b" : "#ccc" }} />
                        <div>
                          <div className="text-sm font-medium" style={{ color: "#111" }}>{rfq.title}</div>
                          <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "#b0a49e" }}>
                            <span>{new Date(rfq.created_at).toLocaleDateString("tr-TR")}</span>
                            {deadline && (
                              <span className="flex items-center gap-1" style={{ color: isOverdue ? "#c0392b" : "#b0a49e" }}>
                                {isOverdue && <AlertTriangle className="w-3 h-3" />}
                                Son: {deadline.toLocaleDateString("tr-TR")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{
                            background: isOpen ? "#fdf0ee" : "#f5f0eb",
                            color: isOpen ? "#8b3a2a" : "#7a6e67",
                          }}
                        >
                          {isOpen ? "Açık" : "Kapalı"}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" style={{ color: "#ccc" }} />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: "1px solid #e6ddd4" }}>
              <p className="text-xs" style={{ color: "#b0a49e" }}>Son 5 teklif talebi gösteriliyor</p>
              <Link
                href="/rfq/new"
                className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded"
                style={{ background: "#111", color: "#fff" }}
              >
                + Yeni Teklif
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Hızlı Erişim */}
      <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
        <div className="px-6 py-4" style={{ borderBottom: "1px solid #e6ddd4" }}>
          <h2 className="text-sm font-semibold" style={{ color: "#111" }}>HIZLI ERİŞİM</h2>
        </div>
        <div className="grid grid-cols-2 divide-x" style={{ borderColor: "#e6ddd4" }}>
          <Link
            href="/rfq/new"
            className="flex items-center gap-4 px-6 py-5 transition-colors hover:bg-amber-50"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#111" }}>
              <span className="text-white text-lg font-bold leading-none">+</span>
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: "#111" }}>Yeni Teklif Talebi</div>
              <div className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>Tedarikçilere teklif isteği gönder</div>
            </div>
          </Link>
          <Link
            href="/suppliers"
            className="flex items-center gap-4 px-6 py-5 transition-colors hover:bg-amber-50"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#f5ede6" }}>
              <span className="text-base font-bold" style={{ color: "#8b3a2a" }}>👥</span>
            </div>
            <div>
              <div className="text-sm font-semibold" style={{ color: "#111" }}>Tedarikçi Yönetimi</div>
              <div className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>{supplierCount ?? 0} firma kayıtlı</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

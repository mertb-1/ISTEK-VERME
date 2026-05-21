import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { AlertTriangle, ArrowRight, FileText, Users } from "lucide-react";
import ActivityFeed, { ActivityItem } from "./ActivityFeed";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";

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

  const [
    { count: awaitingCount },
    { data: activityRfqs },
    activityRecipientsResult,
    { data: activityOrders },
  ] = await Promise.all([
    rfqIdList.length > 0
      ? admin.from("rfq_recipients").select("id", { count: "exact", head: true }).eq("status", "sent").in("rfq_id", rfqIdList)
      : Promise.resolve({ count: 0 }),
    supabase.from("rfqs").select("id, title, created_at").eq("buyer_id", user!.id).order("created_at", { ascending: false }).limit(30),
    rfqIdList.length > 0
      ? admin.from("rfq_recipients").select("rfq_id, sent_at, responded_at, awarded_at, suppliers(company_name)").in("rfq_id", rfqIdList)
      : Promise.resolve({ data: [] as { rfq_id: string; sent_at: string | null; responded_at: string | null; awarded_at: string | null; suppliers: unknown }[] }),
    supabase.from("orders").select("id, rfq_id, completed_at, cancelled_at").eq("buyer_id", user!.id),
  ]);

  // Build activity feed
  const rfqTitleMap: Record<string, string> = {};
  for (const r of activityRfqs ?? []) rfqTitleMap[r.id] = r.title;

  const feedItems: ActivityItem[] = [];

  for (const rfq of activityRfqs ?? []) {
    feedItems.push({ type: "rfq_created", message: `"${rfq.title}" teklif talebi oluşturuldu`, timestamp: rfq.created_at, link: `/rfq/${rfq.id}` });
  }

  for (const rec of (activityRecipientsResult.data ?? [])) {
    const supplierRaw = rec.suppliers;
    const supplierName = supplierRaw
      ? ((Array.isArray(supplierRaw) ? supplierRaw[0] : supplierRaw) as { company_name: string } | null)?.company_name ?? "Tedarikçi"
      : "Tedarikçi";
    const rfqLink = rec.rfq_id ? `/rfq/${rec.rfq_id}` : undefined;

    if (rec.sent_at)      feedItems.push({ type: "rfq_sent",      message: `${supplierName} firmasına teklif isteği gönderildi`, timestamp: rec.sent_at,      link: rfqLink });
    if (rec.responded_at) feedItems.push({ type: "quote_received", message: `${supplierName} teklif gönderdi`,                   timestamp: rec.responded_at, link: rfqLink });
    if (rec.awarded_at)   feedItems.push({ type: "order_created",  message: `${supplierName} seçildi, sipariş oluşturuldu`,      timestamp: rec.awarded_at,   link: rfqLink });
  }

  for (const order of activityOrders ?? []) {
    const title = order.rfq_id ? rfqTitleMap[order.rfq_id] : undefined;
    const label = title ? `"${title}"` : "Sipariş";
    if (order.completed_at) feedItems.push({ type: "order_completed", message: `${label} tamamlandı`, timestamp: order.completed_at, link: `/orders/${order.id}` });
    if (order.cancelled_at) feedItems.push({ type: "order_cancelled", message: `${label} iptal edildi`, timestamp: order.cancelled_at, link: `/orders/${order.id}` });
  }

  const feed = feedItems
    .filter((i) => i.timestamp)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 20);

  const companyName = buyer?.company_name || buyer?.full_name || "Firma";
  const today = new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).toUpperCase();

  const awaiting = awaitingCount ?? 0;

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <PageHeader
        eyebrow={today}
        title={companyName}
        accentWord="panosu."
        description={`${rfqCount ?? 0} teklif talebi · ${supplierCount ?? 0} kayıtlı tedarikçi`}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Link
          href="/rfq/new"
          className="flex items-center gap-4 px-5 py-4 rounded-xl transition-colors group"
          style={{ background: "#111", color: "#fff" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#222"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#111"; }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)" }}>
            <span className="text-white text-xl font-bold leading-none">+</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Yeni Teklif Talebi</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>Tedarikçilere teklif isteği gönder</div>
          </div>
        </Link>

        <Link
          href="/suppliers"
          className="flex items-center gap-4 px-5 py-4 rounded-xl transition-colors"
          style={{ background: "#fff", border: "1px solid #e6ddd4" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#fef5e4"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#fff"; }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "#f5f0eb" }}>
            <Users className="w-4 h-4" style={{ color: "#7a6e67" }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: "#111" }}>Tedarikçi Yönetimi</div>
            <div className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>{supplierCount ?? 0} firma kayıtlı</div>
          </div>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="TOPLAM TEKLİF"
          value={rfqCount ?? 0}
          sub="oluşturulan teklif talebi"
        />
        <StatCard
          label="TEDARİKÇİ"
          value={supplierCount ?? 0}
          sub="kayıtlı firma"
        />
        <StatCard
          label="CEVAP BEKLEYEN"
          value={awaiting}
          sub="tedarikçi henüz yanıtlamadı"
          variant={awaiting > 0 ? "warning" : "default"}
        />
      </div>

      {/* Two-column: recent RFQs + activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent RFQs */}
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
            <h2 className="text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>SON TEKLİF TALEPLERİ</h2>
            <Link href="/rfq" className="text-xs font-medium transition-opacity hover:opacity-70" style={{ color: "#7a6e67" }}>
              Tümü →
            </Link>
          </div>

          {!recentRfqs || recentRfqs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Henüz teklif talebi yok"
              description="İlk teklif talebinizi oluşturun."
              className="py-10"
            >
              <Link
                href="/rfq/new"
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded"
                style={{ background: "#111", color: "#fff" }}
              >
                + Yeni Teklif
              </Link>
            </EmptyState>
          ) : (
            <>
              <ul>
                {recentRfqs.map((rfq, idx) => {
                  const isOpen = rfq.status === "open";
                  const deadline = rfq.deadline ? new Date(rfq.deadline) : null;
                  const isOverdue = deadline && deadline < new Date() && isOpen;
                  const isLast = idx === recentRfqs.length - 1;

                  return (
                    <li key={rfq.id} style={!isLast ? { borderBottom: "1px solid #f0e8e0" } : undefined}>
                      <Link
                        href={`/rfq/${rfq.id}`}
                        className="flex items-center justify-between px-5 py-3.5 transition-colors"
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "#fef5e4"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = ""; }}
                      >
                        <div className="flex-1 min-w-0 mr-3">
                          <div className="text-sm font-medium truncate" style={{ color: "#111" }}>{rfq.title}</div>
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
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusBadge status={rfq.status} />
                          <ArrowRight className="w-3.5 h-3.5" style={{ color: "#d0c8c0" }} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: "1px solid #f0e8e0" }}>
                <p className="text-xs" style={{ color: "#b0a49e" }}>Son 5 teklif talebi</p>
                <Link
                  href="/rfq/new"
                  className="text-xs font-semibold px-3 py-1.5 rounded transition-opacity hover:opacity-80"
                  style={{ background: "#111", color: "#fff" }}
                >
                  + Yeni Teklif
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Activity feed */}
        <ActivityFeed items={feed} />
      </div>
    </div>
  );
}

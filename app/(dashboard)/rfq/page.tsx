import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default async function RfqListPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rfqs } = await supabase
    .from("rfqs")
    .select(`id, title, status, deadline, created_at, rfq_recipients(count), rfq_items(count)`)
    .eq("buyer_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8 max-w-5xl">
      {/* Heading */}
      <div className="mb-8">
        <p className="text-xs tracking-widest mb-3" style={{ color: "#7a6e67", letterSpacing: "0.12em" }}>
          SATIN ALMA · RFQ&apos;LAR
        </p>
        <div className="flex items-end justify-between">
          <h1 className="font-display text-5xl leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            RFQ <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>kütüğü.</em>
          </h1>
          <Link
            href="/rfq/new"
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded mb-1"
            style={{ background: "#111", color: "#fff" }}
          >
            + Yeni RFQ
          </Link>
        </div>
        <p className="text-sm mt-2" style={{ color: "#7a6e67" }}>
          Filonuza giden tüm teklif talepleri ve durumları. Kapalı olanları arşivden geri getirebilirsiniz.
        </p>
      </div>

      {!rfqs || rfqs.length === 0 ? (
        <div className="rounded-xl px-6 py-20 text-center" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <p className="text-sm mb-2" style={{ color: "#7a6e67" }}>Henüz teklif oluşturmadınız.</p>
          <Link
            href="/rfq/new"
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded mt-4"
            style={{ background: "#111", color: "#fff" }}
          >
            + İlk RFQ&apos;yu Oluştur
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rfqs.map((rfq) => {
            const recipientCount = (rfq.rfq_recipients as unknown as { count: number }[])?.[0]?.count ?? 0;
            const itemCount = (rfq.rfq_items as unknown as { count: number }[])?.[0]?.count ?? 0;
            const isOpen = rfq.status === "open";
            const deadline = rfq.deadline ? new Date(rfq.deadline) : null;
            const isOverdue = deadline && deadline < new Date() && isOpen;

            return (
              <Link
                key={rfq.id}
                href={`/rfq/${rfq.id}`}
                className="block rounded-xl p-5 transition-all group hover:border-orange-800"
                style={{ background: "#fff", border: "1px solid #e6ddd4" }}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-mono" style={{ color: "#b0a49e" }}>
                    RFQ-{rfq.id.slice(0, 8).toUpperCase()}
                  </span>
                  <span
                    className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
                    style={{
                      background: isOpen ? "#fdf0ee" : "#f5f0eb",
                      color: isOpen ? "#8b3a2a" : "#7a6e67",
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: isOpen ? "#c0392b" : "#aaa" }}
                    />
                    {isOpen ? "Açık" : "Kapalı"}
                  </span>
                </div>

                <h3 className="font-semibold text-base mb-3 leading-snug" style={{ color: "#111" }}>
                  {rfq.title}
                </h3>

                {/* Progress bar */}
                <div className="w-full h-1 rounded-full mb-3 overflow-hidden" style={{ background: "#f0e8e0" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: recipientCount > 0 ? `${Math.min(100, (recipientCount / Math.max(recipientCount, 6)) * 100)}%` : "0%",
                      background: isOpen ? "#8b3a2a" : "#aaa",
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs" style={{ color: "#7a6e67" }}>
                  <span>{itemCount} kalem · {recipientCount} tedarikçi</span>
                  <div className="flex items-center gap-1">
                    {isOverdue && <AlertTriangle className="w-3 h-3" style={{ color: "#c0392b" }} />}
                    {deadline && (
                      <span style={{ color: isOverdue ? "#c0392b" : "#b0a49e" }}>
                        {deadline.toLocaleDateString("tr-TR")}
                      </span>
                    )}
                    <span className="ml-2 font-medium" style={{ color: "#111" }}>
                      İncele →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

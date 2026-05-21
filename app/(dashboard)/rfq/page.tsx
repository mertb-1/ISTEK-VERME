import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import RfqList, { RfqRow } from "./RfqList";

export const dynamic = "force-dynamic";

export default async function RfqListPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: rfqs, error: rfqsErr } = await admin
    .from("rfqs")
    .select(`id, title, status, deadline, created_at, awarded_recipient_id, rfq_recipients(count), rfq_items(count)`)
    .eq("buyer_id", user!.id)
    .order("created_at", { ascending: false });

  if (rfqsErr) console.error("rfqs fetch error:", rfqsErr.code, rfqsErr.message);

  const rows: RfqRow[] = (rfqs ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    deadline: r.deadline,
    created_at: r.created_at,
    awarded_recipient_id: r.awarded_recipient_id ?? null,
    recipient_count: (r.rfq_recipients as unknown as { count: number }[])?.[0]?.count ?? 0,
    item_count: (r.rfq_items as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));

  return (
    <div className="p-8 max-w-5xl">
      {/* Heading */}
      <div className="mb-8">
        <p className="text-xs tracking-widest mb-3" style={{ color: "#7a6e67", letterSpacing: "0.12em" }}>
          SATIN ALMA · TEKLİF TALEPLERİ
        </p>
        <div className="flex items-end justify-between">
          <h1 className="font-display text-5xl leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Teklif <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>kütüğü.</em>
          </h1>
          <Link
            href="/rfq/new"
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded mb-1"
            style={{ background: "#111", color: "#fff" }}
          >
            + Yeni Teklif
          </Link>
        </div>
        <p className="text-sm mt-2" style={{ color: "#7a6e67" }}>
          Filonuza giden tüm teklif talepleri ve durumları.
        </p>
      </div>

      <RfqList rfqs={rows} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import RfqList, { RfqRow } from "./RfqList";
import PageHeader from "@/components/PageHeader";
import { FileSpreadsheet, Plus, FileCheck2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RfqListPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: rfqs, error: rfqsErr } = await admin
    .from("rfqs")
    .select(`id, title, status, deadline, created_at, awarded_recipient_id, rfq_recipients!rfq_recipients_rfq_id_fkey(count), rfq_items!rfq_items_rfq_id_fkey(count)`)
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
    <div className="w-full max-w-[1440px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
      <PageHeader
        eyebrow="SATIN ALMA · TEKLİF TALEPLERİ"
        title="Teklif"
        accentWord="kütüğü."
        description="Filonuza giden tüm teklif talepleri ve durumları."
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/rfq/import-answered"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors hover:bg-[#fef5e4]"
              style={{ background: "#fff", color: "#111", border: "1px solid #e6ddd4" }}
            >
              <FileCheck2 className="w-4 h-4" style={{ color: "#8b3a2a" }} />
              Cevaplanmış Teklif Yükle
            </Link>
            <Link
              href="/rfq/new/upload"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors hover:bg-[#fef5e4]"
              style={{ background: "#fff", color: "#111", border: "1px solid #e6ddd4" }}
            >
              <FileSpreadsheet className="w-4 h-4" style={{ color: "#7a6e67" }} />
              Excel&apos;den
            </Link>
            <Link
              href="/rfq/new"
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-lg transition-opacity hover:opacity-90"
              style={{ background: "#111", color: "#fff" }}
            >
              <Plus className="w-4 h-4" />
              Yeni Talep
            </Link>
          </div>
        }
      />
      <RfqList rfqs={rows} />
    </div>
  );
}

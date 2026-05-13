import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function RfqListPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: rfqs } = await supabase
    .from("rfqs")
    .select(`
      id, title, status, deadline, created_at,
      rfq_recipients(count),
      rfq_items(count)
    `)
    .eq("buyer_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tekliflerim</h1>
          <p className="text-gray-500 mt-1">{rfqs?.length ?? 0} teklif</p>
        </div>
        <Link
          href="/rfq/new"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Yeni Teklif
        </Link>
      </div>

      {!rfqs || rfqs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-gray-500 mb-5">Henüz teklif oluşturmadınız.</p>
          <Link
            href="/rfq/new"
            className="inline-block bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700"
          >
            İlk Teklifi Oluştur
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
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
                className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-6 py-4 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      isOpen ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <div>
                    <div className="font-semibold text-gray-900">{rfq.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {itemCount} ürün · {recipientCount} tedarikçi ·{" "}
                      {new Date(rfq.created_at).toLocaleDateString("tr-TR")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {deadline && (
                    <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
                      Son: {deadline.toLocaleDateString("tr-TR")}
                    </span>
                  )}
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {isOpen ? "Açık" : "Kapalı"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

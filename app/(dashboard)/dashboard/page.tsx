import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ count: rfqCount }, { count: supplierCount }, { data: recentRfqs }] =
    await Promise.all([
      supabase
        .from("rfqs")
        .select("*", { count: "exact", head: true })
        .eq("buyer_id", user!.id),
      supabase
        .from("suppliers")
        .select("*", { count: "exact", head: true })
        .eq("buyer_id", user!.id),
      supabase
        .from("rfqs")
        .select("id, title, status, created_at, deadline")
        .eq("buyer_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Ana Sayfa</h1>
        <p className="text-gray-500 mt-1">Hoş geldiniz, işte genel durumunuz.</p>
      </div>

      {/* İstatistik kartları */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-blue-600">{rfqCount ?? 0}</div>
          <div className="text-sm text-gray-500 mt-1">Toplam Teklif</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-green-600">{supplierCount ?? 0}</div>
          <div className="text-sm text-gray-500 mt-1">Tedarikçi</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="text-3xl font-bold text-orange-500">0</div>
          <div className="text-sm text-gray-500 mt-1">Bekleyen Cevap</div>
        </div>
      </div>

      {/* Son teklifler */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Son Teklifler</h2>
          <Link href="/rfq/new" className="text-sm text-blue-600 hover:underline font-medium">
            + Yeni Teklif
          </Link>
        </div>

        {!recentRfqs || recentRfqs.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 mb-4">Henüz teklif oluşturmadınız.</p>
            <Link
              href="/rfq/new"
              className="inline-block bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700"
            >
              İlk Teklifi Oluştur
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recentRfqs.map((rfq) => (
              <li key={rfq.id}>
                <Link
                  href={`/rfq/${rfq.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <div className="font-medium text-gray-900">{rfq.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(rfq.created_at).toLocaleDateString("tr-TR")}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      rfq.status === "open"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {rfq.status === "open" ? "Açık" : "Kapalı"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

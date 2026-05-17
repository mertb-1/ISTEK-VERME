import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FileText, Users, Clock, Plus, ArrowRight, CheckCircle, Circle } from "lucide-react";

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
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Ana Sayfa</h1>
        <p className="text-gray-500 mt-1">Hoş geldiniz, işte genel durumunuz.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Teklif</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{rfqCount ?? 0}</div>
          <div className="text-sm text-gray-500 mt-0.5">Toplam oluşturulan</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tedarikçi</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">{supplierCount ?? 0}</div>
          <div className="text-sm text-gray-500 mt-0.5">Kayıtlı tedarikçi</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Bekleyen</span>
          </div>
          <div className="text-3xl font-bold text-gray-900">0</div>
          <div className="text-sm text-gray-500 mt-0.5">Cevaplanmamış</div>
        </div>
      </div>

      {/* Recent RFQs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Son Teklifler</h2>
          <Link
            href="/rfq/new"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Yeni Teklif
          </Link>
        </div>

        {!recentRfqs || recentRfqs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 mb-4">Henüz teklif oluşturmadınız.</p>
            <Link
              href="/rfq/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              İlk Teklifi Oluştur
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {recentRfqs.map((rfq) => {
                const isOpen = rfq.status === "open";
                return (
                  <li key={rfq.id}>
                    <Link
                      href={`/rfq/${rfq.id}`}
                      className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">{rfq.title}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {new Date(rfq.created_at).toLocaleDateString("tr-TR")}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            isOpen
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {isOpen ? "Açık" : "Kapalı"}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="px-6 py-3 border-t border-gray-100">
              <Link
                href="/rfq"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
              >
                Tüm teklifleri gör
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

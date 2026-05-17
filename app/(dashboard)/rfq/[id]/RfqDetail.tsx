"use client";

import Link from "next/link";
import { CheckCircle, Clock, Mail, XCircle, AlertTriangle, Trophy, Package } from "lucide-react";

type RfqItem = { id: string; product_name: string; brand: string; quantity: number; unit: string };
type QuoteItem = { rfq_item_id: string; unit_price: number; total_price: number; offered_brand: string; in_stock: boolean; notes: string };
type Quote = { id: string; total_amount: number; delivery_time: string; payment_terms: string; supplier_notes: string; quote_items: QuoteItem[] };
type Supplier = { id: string; company_name: string; email: string; contact_name: string };
type Recipient = { id: string; status: string; magic_token: string; sent_at: string; responded_at: string; suppliers: Supplier | Supplier[]; quotes: Quote[] };

function getSupplier(r: Recipient): Supplier {
  return Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sent: { label: "Gönderildi", icon: <Mail className="w-3.5 h-3.5" />, color: "text-gray-500 bg-gray-100" },
  opened: { label: "Açıldı", icon: <Clock className="w-3.5 h-3.5" />, color: "text-yellow-700 bg-yellow-100" },
  responded: { label: "Cevap Verdi", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-emerald-700 bg-emerald-100" },
  expired: { label: "Süresi Geçti", icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-600 bg-red-50" },
};

function formatPrice(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

export default function RfqDetail({
  rfq,
  items,
  recipients,
}: {
  rfq: { id: string; title: string; status: string; deadline: string; notes: string; created_at: string };
  items: RfqItem[];
  recipients: Recipient[];
}) {
  const respondedRecipients = recipients.filter((r) => r.quotes && r.quotes.length > 0);
  const pendingRecipients = recipients.filter((r) => !r.quotes || r.quotes.length === 0);

  const getPriceForItem = (recipient: Recipient, itemId: string): QuoteItem | undefined => {
    const quote = recipient.quotes?.[0];
    return quote?.quote_items?.find((qi) => qi.rfq_item_id === itemId);
  };

  const getMinPriceForItem = (itemId: string): number | null => {
    const prices = respondedRecipients
      .map((r) => getPriceForItem(r, itemId)?.unit_price)
      .filter((p): p is number => typeof p === "number" && p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  const cheapestMixTotal = items.reduce((sum, item) => {
    const min = getMinPriceForItem(item.id);
    return sum + (min ? min * item.quantity : 0);
  }, 0);

  // Hangi tedarikçi genel olarak en ucuz?
  const cheapestSupplierRecipient = respondedRecipients.length > 0
    ? respondedRecipients.reduce((cheapest, r) => {
        const t = r.quotes?.[0]?.total_amount ?? Infinity;
        const ct = cheapest.quotes?.[0]?.total_amount ?? Infinity;
        return t < ct ? r : cheapest;
      })
    : null;

  return (
    <div className="p-8 max-w-full">
      {/* Breadcrumb + header */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
          <Link href="/rfq" className="hover:text-gray-600 transition-colors">Tekliflerim</Link>
          <span>/</span>
          <span className="text-gray-600 truncate max-w-xs">{rfq.title}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{rfq.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-gray-400">{new Date(rfq.created_at).toLocaleDateString("tr-TR")}</span>
              {rfq.deadline && (
                <span className="text-sm text-gray-400">Son: {new Date(rfq.deadline).toLocaleDateString("tr-TR")}</span>
              )}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                rfq.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
              }`}>
                {rfq.status === "open" ? "Açık" : "Kapalı"}
              </span>
            </div>
            {rfq.notes && (
              <p className="text-sm text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-2 inline-block">{rfq.notes}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0 text-sm text-gray-500">
            <span className="font-medium text-gray-900">{items.length}</span> ürün &middot;{" "}
            <span className="font-medium text-gray-900">{recipients.length}</span> tedarikçi
          </div>
        </div>
      </div>

      {/* No responses yet */}
      {respondedRecipients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-700 font-medium mb-1">Henüz cevap gelmedi</p>
          <p className="text-sm text-gray-400 mb-6">Tedarikçiler mail içindeki link üzerinden fiyat girecek.</p>
          {/* Pending suppliers list */}
          <div className="flex flex-wrap gap-2 justify-center">
            {recipients.map((r) => {
              const s = getSupplier(r);
              const cfg = statusConfig[r.status] ?? statusConfig.sent;
              return (
                <span key={r.id} className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${cfg.color}`}>
                  {cfg.icon}
                  {s?.company_name}
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Table toolbar */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">Karşılaştırma Tablosu</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {respondedRecipients.length}/{recipients.length} tedarikçi yanıtladı
              </span>
            </div>
            {cheapestMixTotal > 0 && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
                <Trophy className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700">
                  En ucuz karma: <span className="font-bold">{formatPrice(cheapestMixTotal)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {/* Sticky header */}
              <thead>
                {/* Supplier name row */}
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-5 py-4 font-medium text-gray-500 min-w-[220px] sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Ürün
                    </div>
                  </th>
                  {respondedRecipients.map((r) => {
                    const s = getSupplier(r);
                    const isOverallCheapest = cheapestSupplierRecipient?.id === r.id;
                    return (
                      <th key={r.id} className="text-center px-4 py-4 min-w-[180px] border-r border-gray-100 last:border-r-0">
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                              {getInitials(s?.company_name ?? "?")}
                            </div>
                            <span className="font-semibold text-gray-900 text-sm">{s?.company_name}</span>
                            {isOverallCheapest && respondedRecipients.length > 1 && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                                <Trophy className="w-3 h-3" />
                                En ucuz
                              </span>
                            )}
                          </div>
                          {r.quotes?.[0]?.delivery_time && (
                            <span className="text-xs text-gray-400 font-normal">{r.quotes[0].delivery_time}</span>
                          )}
                          {r.quotes?.[0]?.payment_terms && (
                            <span className="text-xs text-gray-400 font-normal">{r.quotes[0].payment_terms}</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {/* Pending suppliers as faded columns */}
                  {pendingRecipients.map((r) => {
                    const s = getSupplier(r);
                    return (
                      <th key={r.id} className="text-center px-4 py-4 min-w-[160px] border-r border-gray-100 last:border-r-0 opacity-50">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-400">
                            {getInitials(s?.company_name ?? "?")}
                          </div>
                          <span className="font-medium text-gray-500 text-sm">{s?.company_name}</span>
                          <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            Bekleniyor
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {items.map((item, rowIdx) => {
                  const minPrice = getMinPriceForItem(item.id);
                  const isEven = rowIdx % 2 === 0;
                  return (
                    <tr key={item.id} className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${isEven ? "bg-white" : "bg-gray-50/40"}`}>
                      {/* Product cell */}
                      <td className={`px-5 py-4 sticky left-0 z-10 border-r border-gray-200 ${isEven ? "bg-white" : "bg-gray-50/60"}`}>
                        <div className="font-medium text-gray-900 leading-snug">{item.product_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {item.quantity} {item.unit}
                          </span>
                          {item.brand && (
                            <span className="text-xs text-gray-400">{item.brand}</span>
                          )}
                        </div>
                      </td>

                      {/* Responded supplier cells */}
                      {respondedRecipients.map((r) => {
                        const qi = getPriceForItem(r, item.id);
                        const isCheapest = qi && minPrice !== null && qi.unit_price === minPrice;
                        const brandMatch = !qi?.offered_brand || !item.brand ||
                          qi.offered_brand.toLowerCase() === item.brand.toLowerCase();
                        const brandMismatch = qi?.offered_brand && item.brand && !brandMatch;

                        return (
                          <td
                            key={r.id}
                            className={`px-4 py-4 text-center border-r border-gray-100 last:border-r-0 transition-colors ${
                              isCheapest
                                ? "bg-emerald-50"
                                : ""
                            }`}
                          >
                            {qi ? (
                              <div className="space-y-1">
                                <div className={`text-base font-bold tabular-nums ${
                                  isCheapest ? "text-emerald-700" : "text-gray-900"
                                }`}>
                                  {formatPrice(qi.unit_price)}
                                  {isCheapest && respondedRecipients.length > 1 && (
                                    <span className="ml-1.5 inline-flex items-center text-emerald-600">
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-400 tabular-nums">
                                  Toplam: {formatPrice(qi.unit_price * item.quantity)}
                                </div>
                                {qi.offered_brand && (
                                  <div className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                                    brandMismatch
                                      ? "text-amber-700 bg-amber-50 border border-amber-200"
                                      : "text-gray-500 bg-gray-100"
                                  }`}>
                                    {brandMismatch ? (
                                      <><AlertTriangle className="w-3 h-3" /> {qi.offered_brand}</>
                                    ) : (
                                      <><CheckCircle className="w-3 h-3 text-gray-400" /> {qi.offered_brand}</>
                                    )}
                                  </div>
                                )}
                                {!qi.in_stock && (
                                  <div className="text-xs text-red-500 font-medium">Stokta yok</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-lg">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Pending supplier cells */}
                      {pendingRecipients.map((r) => (
                        <td key={r.id} className="px-4 py-4 text-center border-r border-gray-100 last:border-r-0 opacity-40">
                          <span className="text-gray-300 text-lg">—</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* TOPLAM row */}
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td className="px-5 py-4 sticky left-0 bg-gray-50 z-10 border-r border-gray-200">
                    <div className="font-bold text-gray-900 text-sm uppercase tracking-wider">Toplam</div>
                    <div className="text-xs text-gray-400 mt-0.5 font-normal">Tedarikçi toplamı</div>
                  </td>
                  {respondedRecipients.map((r) => {
                    const total = r.quotes?.[0]?.total_amount;
                    const isOverallCheapest = cheapestSupplierRecipient?.id === r.id && respondedRecipients.length > 1;
                    return (
                      <td key={r.id} className={`px-4 py-4 text-center border-r border-gray-100 last:border-r-0 ${
                        isOverallCheapest ? "bg-emerald-50" : ""
                      }`}>
                        <div className={`text-xl font-bold tabular-nums ${
                          isOverallCheapest ? "text-emerald-700" : "text-gray-900"
                        }`}>
                          {formatPrice(total)}
                        </div>
                        {isOverallCheapest && (
                          <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            <Trophy className="w-3 h-3" />
                            En ucuz
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {pendingRecipients.map((r) => (
                    <td key={r.id} className="px-4 py-4 text-center opacity-40 border-r border-gray-100 last:border-r-0">
                      <span className="text-gray-300">—</span>
                    </td>
                  ))}
                </tr>

                {/* EN UCUZ KARMA row */}
                {cheapestMixTotal > 0 && (
                  <tr className="bg-emerald-50 border-t border-emerald-200">
                    <td className="px-5 py-4 sticky left-0 bg-emerald-50 z-10 border-r border-emerald-200">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-emerald-600" />
                        <div>
                          <div className="font-bold text-emerald-800 text-sm uppercase tracking-wider">En Ucuz Karma</div>
                          <div className="text-xs text-emerald-600 mt-0.5 font-normal">Her üründen en düşük</div>
                        </div>
                      </div>
                    </td>
                    <td colSpan={respondedRecipients.length + pendingRecipients.length} className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-emerald-700 tabular-nums">{formatPrice(cheapestMixTotal)}</span>
                        <span className="text-sm text-emerald-600">
                          Her üründe en ucuz teklifi seçerek elde edilebilecek teorik minimum
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Supplier notes */}
          {respondedRecipients.some((r) => r.quotes?.[0]?.supplier_notes) && (
            <div className="border-t border-gray-200 px-6 py-5 bg-gray-50">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Tedarikçi Notları</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {respondedRecipients.map((r) => {
                  const note = r.quotes?.[0]?.supplier_notes;
                  if (!note) return null;
                  return (
                    <div key={r.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
                      <div className="text-xs font-semibold text-gray-700 mb-1">{getSupplier(r)?.company_name}</div>
                      <div className="text-sm text-gray-600">{note}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Select supplier row */}
          <div className="border-t border-gray-200 px-6 py-4 bg-white">
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              <span className="text-sm text-gray-500 font-medium flex-shrink-0">Tedarikçi seç:</span>
              {respondedRecipients.map((r) => {
                const s = getSupplier(r);
                const isOverallCheapest = cheapestSupplierRecipient?.id === r.id && respondedRecipients.length > 1;
                return (
                  <button
                    key={r.id}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex-shrink-0 ${
                      isOverallCheapest
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                        : "bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                    }`}
                  >
                    {isOverallCheapest && <Trophy className="w-3.5 h-3.5" />}
                    {s?.company_name}
                    <span className={`text-xs font-normal ${isOverallCheapest ? "text-emerald-200" : "text-gray-400"}`}>
                      {formatPrice(r.quotes?.[0]?.total_amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { CheckCircle, Clock, Mail, XCircle } from "lucide-react";


type RfqItem = { id: string; product_name: string; brand: string; quantity: number; unit: string };
type QuoteItem = { rfq_item_id: string; unit_price: number; total_price: number; offered_brand: string; in_stock: boolean; notes: string };
type Quote = { id: string; total_amount: number; delivery_time: string; payment_terms: string; supplier_notes: string; quote_items: QuoteItem[] };
type Supplier = { id: string; company_name: string; email: string; contact_name: string };
type Recipient = { id: string; status: string; magic_token: string; sent_at: string; responded_at: string; suppliers: Supplier | Supplier[]; quotes: Quote[] };

function getSupplier(r: Recipient): Supplier {
  return Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sent: { label: "Gönderildi", icon: <Mail className="w-3.5 h-3.5" />, color: "text-gray-500 bg-gray-100" },
  opened: { label: "Açıldı", icon: <Clock className="w-3.5 h-3.5" />, color: "text-yellow-700 bg-yellow-100" },
  responded: { label: "Cevap Verdi", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "text-green-700 bg-green-100" },
  expired: { label: "Süresi Geçti", icon: <XCircle className="w-3.5 h-3.5" />, color: "text-red-700 bg-red-100" },
};

function formatPrice(n: number | null) {
  if (!n) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD" }).format(n);
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

  // Her ürün için her tedarikçinin fiyatını bul
  const getPriceForItem = (recipient: Recipient, itemId: string): QuoteItem | undefined => {
    const quote = recipient.quotes?.[0];
    return quote?.quote_items?.find((qi) => qi.rfq_item_id === itemId);
  };

  // Her ürün için en düşük fiyatı bul
  const getMinPriceForItem = (itemId: string): number | null => {
    const prices = respondedRecipients
      .map((r) => getPriceForItem(r, itemId)?.unit_price)
      .filter((p): p is number => typeof p === "number" && p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  // "En ucuz karma" hesapla
  const cheapestMixTotal = items.reduce((sum, item) => {
    const min = getMinPriceForItem(item.id);
    return sum + (min ? min * item.quantity : 0);
  }, 0);

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
            <Link href="/rfq" className="hover:text-gray-600 transition-colors">Tekliflerim</Link>
            <span>/</span>
            <span className="text-gray-600">{rfq.title}</span>
          </div>
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
      </div>

      {/* Supplier status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {recipients.map((r) => {
          const cfg = statusConfig[r.status] ?? statusConfig.sent;
          const quote = r.quotes?.[0];
          const supplier = getSupplier(r);
          const initials = supplier?.company_name
            .split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() ?? "?";
          return (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 flex-shrink-0">
                  {initials}
                </div>
                <div className="font-medium text-gray-900 text-sm truncate">{supplier?.company_name}</div>
              </div>
              <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                {cfg.icon} {cfg.label}
              </div>
              {quote && (
                <div className="mt-2.5 text-base font-bold text-gray-900">{formatPrice(quote.total_amount)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      {respondedRecipients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-gray-700 font-medium mb-1">Henüz cevap gelmedi</p>
          <p className="text-sm text-gray-400">Tedarikçiler mail içindeki link üzerinden fiyat girecek.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Karşılaştırma Tablosu</h2>
            {cheapestMixTotal > 0 && (
              <div className="text-sm text-gray-500">
                En ucuz karma:{" "}
                <span className="font-semibold text-emerald-700">{formatPrice(cheapestMixTotal)}</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 w-52 sticky left-0 bg-gray-50">Ürün</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500 w-24">Miktar</th>
                  {respondedRecipients.map((r) => (
                    <th key={r.id} className="text-center px-4 py-3 font-medium text-gray-700 min-w-[150px]">
                      <div>{getSupplier(r)?.company_name}</div>
                      {r.quotes?.[0]?.delivery_time && (
                        <div className="text-xs text-gray-400 font-normal mt-0.5">{r.quotes[0].delivery_time}</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const minPrice = getMinPriceForItem(item.id);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 sticky left-0 bg-white">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                        {item.brand && <div className="text-xs text-gray-400 mt-0.5">{item.brand}</div>}
                      </td>
                      <td className="px-3 py-3.5 text-gray-500 text-sm">
                        {item.quantity} {item.unit}
                      </td>
                      {respondedRecipients.map((r) => {
                        const qi = getPriceForItem(r, item.id);
                        const isCheapest = qi && minPrice !== null && qi.unit_price === minPrice;
                        const brandMismatch = qi?.offered_brand && item.brand && qi.offered_brand.toLowerCase() !== item.brand.toLowerCase();
                        return (
                          <td key={r.id} className={`px-4 py-3.5 text-center ${isCheapest ? "bg-emerald-50" : ""}`}>
                            {qi ? (
                              <div>
                                <div className={`font-semibold ${isCheapest ? "text-emerald-700" : "text-gray-900"}`}>
                                  {formatPrice(qi.unit_price)}
                                </div>
                                {qi.offered_brand && (
                                  <div className={`text-xs mt-0.5 ${brandMismatch ? "text-amber-600" : "text-gray-400"}`}>
                                    {brandMismatch && "⚠ "}{qi.offered_brand}
                                  </div>
                                )}
                                {!qi.in_stock && (
                                  <div className="text-xs text-red-400 mt-0.5">Stokta yok</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Total row */}
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-5 py-4 font-bold text-gray-900 text-sm uppercase tracking-wide sticky left-0 bg-gray-50">Toplam</td>
                  <td className="px-3 py-4" />
                  {respondedRecipients.map((r) => {
                    const total = r.quotes?.[0]?.total_amount;
                    const isCheapestTotal =
                      total &&
                      respondedRecipients.every(
                        (other) => !other.quotes?.[0]?.total_amount || other.quotes[0].total_amount >= total
                      );
                    return (
                      <td key={r.id} className={`px-4 py-4 text-center font-bold text-base ${
                        isCheapestTotal ? "text-emerald-700" : "text-gray-900"
                      }`}>
                        {formatPrice(total ?? null)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {respondedRecipients.some((r) => r.quotes?.[0]?.supplier_notes) && (
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tedarikçi Notları</div>
              <div className="space-y-1.5">
                {respondedRecipients.map((r) => {
                  const note = r.quotes?.[0]?.supplier_notes;
                  if (!note) return null;
                  return (
                    <div key={r.id} className="text-sm text-gray-600">
                      <span className="font-medium text-gray-900">{getSupplier(r)?.company_name}:</span> {note}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

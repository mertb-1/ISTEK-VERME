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
    <div className="p-8">
      {/* Başlık */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/rfq" className="hover:text-gray-600">Tekliflerim</Link>
            <span>/</span>
            <span>{rfq.title}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{rfq.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
            <span>{new Date(rfq.created_at).toLocaleDateString("tr-TR")}</span>
            {rfq.deadline && <span>Son: {new Date(rfq.deadline).toLocaleDateString("tr-TR")}</span>}
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${rfq.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {rfq.status === "open" ? "Açık" : "Kapalı"}
            </span>
          </div>
          {rfq.notes && <p className="text-sm text-gray-500 mt-2">{rfq.notes}</p>}
        </div>
      </div>

      {/* Tedarikçi durumu */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        {recipients.map((r) => {
          const cfg = statusConfig[r.status] ?? statusConfig.sent;
          const quote = r.quotes?.[0];
          return (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="font-medium text-gray-900 text-sm truncate mb-1">{getSupplier(r)?.company_name}</div>
              <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.color}`}>
                {cfg.icon} {cfg.label}
              </div>
              {quote && (
                <div className="mt-2 text-sm font-semibold text-gray-900">{formatPrice(quote.total_amount)}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Karşılaştırma Tablosu */}
      {respondedRecipients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-gray-500">Henüz hiçbir tedarikçi cevap vermedi.</p>
          <p className="text-sm text-gray-400 mt-1">Tedarikçiler mail içindeki link üzerinden fiyat girecek.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Karşılaştırma Tablosu</h2>
            {cheapestMixTotal > 0 && (
              <div className="text-sm text-gray-500">
                En ucuz karma:{" "}
                <span className="font-semibold text-green-700">{formatPrice(cheapestMixTotal)}</span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500 w-48">Ürün</th>
                  <th className="text-left px-3 py-3 font-medium text-gray-500 w-20">Miktar</th>
                  {respondedRecipients.map((r) => (
                    <th key={r.id} className="text-center px-3 py-3 font-medium text-gray-700 min-w-[140px]">
                      <div>{getSupplier(r)?.company_name}</div>
                      {r.quotes?.[0]?.delivery_time && (
                        <div className="text-xs text-gray-400 font-normal">{r.quotes[0].delivery_time}</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => {
                  const minPrice = getMinPriceForItem(item.id);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                        {item.brand && <div className="text-xs text-gray-400">{item.brand}</div>}
                      </td>
                      <td className="px-3 py-3 text-gray-500">
                        {item.quantity} {item.unit}
                      </td>
                      {respondedRecipients.map((r) => {
                        const qi = getPriceForItem(r, item.id);
                        const isCheapest = qi && minPrice !== null && qi.unit_price === minPrice;
                        const brandMismatch = qi?.offered_brand && item.brand && qi.offered_brand.toLowerCase() !== item.brand.toLowerCase();
                        return (
                          <td key={r.id} className={`px-3 py-3 text-center ${isCheapest ? "bg-green-50" : ""}`}>
                            {qi ? (
                              <div>
                                <div className={`font-semibold ${isCheapest ? "text-green-700" : "text-gray-900"}`}>
                                  {formatPrice(qi.unit_price)}
                                </div>
                                {qi.offered_brand && (
                                  <div className={`text-xs mt-0.5 ${brandMismatch ? "text-orange-500" : "text-gray-400"}`}>
                                    {brandMismatch && "⚠️ "}{qi.offered_brand}
                                  </div>
                                )}
                                {!qi.in_stock && <div className="text-xs text-red-400 mt-0.5">Stokta yok</div>}
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

                {/* Toplam satırı */}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-5 py-3 text-gray-900">TOPLAM</td>
                  <td className="px-3 py-3" />
                  {respondedRecipients.map((r) => {
                    const total = r.quotes?.[0]?.total_amount;
                    const isCheapestTotal =
                      total &&
                      respondedRecipients.every(
                        (other) => !other.quotes?.[0]?.total_amount || other.quotes[0].total_amount >= total
                      );
                    return (
                      <td key={r.id} className={`px-3 py-3 text-center ${isCheapestTotal ? "text-green-700" : "text-gray-900"}`}>
                        {formatPrice(total ?? null)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notlar */}
          {respondedRecipients.some((r) => r.quotes?.[0]?.supplier_notes) && (
            <div className="border-t border-gray-200 px-6 py-4">
              <div className="text-xs font-medium text-gray-500 uppercase mb-2">Tedarikçi Notları</div>
              <div className="space-y-1">
                {respondedRecipients.map((r) => {
                  const note = r.quotes?.[0]?.supplier_notes;
                  if (!note) return null;
                  return (
                    <div key={r.id} className="text-sm text-gray-600">
                      <span className="font-medium">{getSupplier(r)?.company_name}:</span> {note}
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

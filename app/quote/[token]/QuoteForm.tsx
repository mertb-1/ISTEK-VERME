"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/lib/config";

type RfqItem = {
  id: string;
  product_name: string;
  brand: string;
  quantity: number;
  unit: string;
  description: string;
  impa_code?: string | null;
  detailed_description?: string | null;
  photo_urls?: string[] | null;
};

type QuoteItemInput = {
  rfq_item_id: string;
  unit_price: string;
  offered_brand: string;
  in_stock: boolean;
  notes: string;
};

export default function QuoteForm({
  token,
  recipientId,
  rfq,
  supplier,
  buyerCompany,
  buyerLogoUrl,
  items,
}: {
  token: string;
  recipientId: string;
  rfq: { title: string; notes: string; deadline: string };
  supplier: { company_name: string; contact_name: string };
  buyerCompany: string;
  buyerLogoUrl?: string | null;
  items: RfqItem[];
}) {
  const router = useRouter();
  const [quoteItems, setQuoteItems] = useState<QuoteItemInput[]>(
    items.map((item) => ({
      rfq_item_id: item.id,
      unit_price: "",
      offered_brand: item.brand ?? "",
      in_stock: true,
      notes: "",
    }))
  );
  const [deliveryTime, setDeliveryTime] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateItem = (idx: number, field: keyof QuoteItemInput, value: string | boolean) => {
    setQuoteItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const totalAmount = quoteItems.reduce((sum, qi, idx) => {
    const price = parseFloat(qi.unit_price) || 0;
    const qty = items[idx]?.quantity || 1;
    return sum + price * qty;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const hasAnyPrice = quoteItems.some((qi) => qi.unit_price && parseFloat(qi.unit_price) > 0);
    if (!hasAnyPrice) {
      setError("En az bir ürün için fiyat girmelisiniz.");
      return;
    }

    setSaving(true);

    const res = await fetch("/api/quote/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        recipient_id: recipientId,
        delivery_time: deliveryTime,
        payment_terms: paymentTerms,
        supplier_notes: supplierNotes,
        total_amount: totalAmount,
        items: quoteItems
          .filter((qi) => qi.unit_price && parseFloat(qi.unit_price) > 0)
          .map((qi) => ({
            ...qi,
            unit_price: parseFloat(qi.unit_price),
            total_price: parseFloat(qi.unit_price) * (items.find((i) => i.id === qi.rfq_item_id)?.quantity || 1),
          })),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Bir hata oluştu.");
      setSaving(false);
      return;
    }

    router.push(`/quote/${token}/success`);
  };

  const deadline = rfq.deadline ? new Date(rfq.deadline) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Alıcı firma kimliği */}
      <div className="bg-white border-b border-gray-200 py-5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {buyerLogoUrl ? (
            <img
              src={buyerLogoUrl}
              alt={buyerCompany}
              className="h-12 mx-auto object-contain mb-2"
            />
          ) : (
            <p className="text-lg font-bold text-slate-800 mb-1">{buyerCompany}</p>
          )}
          <p className="text-sm text-gray-500">
            Bu teklif talebi <strong>{buyerCompany}</strong> tarafından gönderilmiştir.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-gray-400 text-sm">{APP_NAME}</span>
          </div>
          <h1 className="text-xl font-bold text-white">{rfq.title}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-gray-400">
            <span>Alıcı: <span className="font-medium text-gray-200">{buyerCompany}</span></span>
            {deadline && (
              <span>Son tarih: <span className="font-medium text-gray-200">{deadline.toLocaleDateString("tr-TR")}</span></span>
            )}
          </div>
          {rfq.notes && (
            <p className="mt-3 text-sm text-gray-400 bg-slate-800 rounded-lg px-3 py-2 inline-block">{rfq.notes}</p>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Ürün Fiyat Tablosu */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Ürün Listesi</h2>
              <p className="text-sm text-gray-500 mt-0.5">Fiyat girebileceğiniz ürünleri doldurun. Temin edemediğiniz ürünleri boş bırakabilirsiniz.</p>
            </div>

            {/* Desktop tablo */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ürün</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-24">Miktar</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">Birim Fiyat *</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-32">Sunulan Marka</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-20">Stok</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-36">Not</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{item.product_name}</div>
                        {item.brand && <div className="text-xs text-gray-400">İstenen marka: {item.brand}</div>}
                        {item.impa_code && <div className="text-xs text-gray-400">IMPA: {item.impa_code}</div>}
                        {item.description && <div className="text-xs text-gray-400 mt-0.5">{item.description}</div>}
                        {item.detailed_description && (
                          <div className="text-xs text-gray-500 mt-1 bg-gray-50 rounded px-2 py-1">{item.detailed_description}</div>
                        )}
                        {item.photo_urls && item.photo_urls.length > 0 && (
                          <div className="flex gap-1.5 mt-2 flex-wrap">
                            {item.photo_urls.map((url, pi) => (
                              <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt="Ürün fotoğrafı" className="w-12 h-12 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{item.quantity} {item.unit}</td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={quoteItems[idx].unit_price}
                            onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                            placeholder="0.00"
                            className="w-full pl-3 pr-2 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={quoteItems[idx].offered_brand}
                          onChange={(e) => updateItem(idx, "offered_brand", e.target.value)}
                          placeholder="Marka"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={quoteItems[idx].in_stock}
                          onChange={(e) => updateItem(idx, "in_stock", e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={quoteItems[idx].notes}
                          onChange={(e) => updateItem(idx, "notes", e.target.value)}
                          placeholder="Ek not..."
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobil kart görünümü */}
            <div className="md:hidden divide-y divide-slate-100">
              {items.map((item, idx) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div>
                    <div className="font-semibold text-gray-900">{item.product_name}</div>
                    <div className="text-sm text-gray-500">{item.quantity} {item.unit}{item.brand ? ` · ${item.brand}` : ""}</div>
                    {item.impa_code && <div className="text-xs text-gray-400 mt-0.5">IMPA: {item.impa_code}</div>}
                    {item.detailed_description && (
                      <div className="text-xs text-gray-500 mt-1 bg-gray-100 rounded px-2 py-1">{item.detailed_description}</div>
                    )}
                    {item.photo_urls && item.photo_urls.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {item.photo_urls.map((url, pi) => (
                          <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt="Ürün fotoğrafı" className="w-12 h-12 object-cover rounded-lg border border-gray-200" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Birim Fiyat *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={quoteItems[idx].unit_price}
                        onChange={(e) => updateItem(idx, "unit_price", e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Sunulan Marka</label>
                      <input
                        type="text"
                        value={quoteItems[idx].offered_brand}
                        onChange={(e) => updateItem(idx, "offered_brand", e.target.value)}
                        placeholder="Marka"
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quoteItems[idx].in_stock}
                        onChange={(e) => updateItem(idx, "in_stock", e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      Stokta mevcut
                    </label>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={quoteItems[idx].notes}
                      onChange={(e) => updateItem(idx, "notes", e.target.value)}
                      placeholder="Bu ürün için not..."
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Toplam */}
            {totalAmount > 0 && (
              <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex justify-between items-center">
                <span className="text-sm font-medium text-blue-700">Tahmini Toplam</span>
                <span className="text-lg font-bold text-blue-800">
                  {new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(totalAmount)} ₺
                </span>
              </div>
            )}
          </div>

          {/* Teslimat ve Ödeme */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Teslimat & Ödeme Koşulları</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Teslimat Süresi</label>
                <input
                  type="text"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  placeholder="Örn: 3-5 iş günü"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ödeme Koşulları</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Örn: Peşin, 30 gün vadeli"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Genel Notlar</label>
              <textarea
                value={supplierNotes}
                onChange={(e) => setSupplierNotes(e.target.value)}
                placeholder="Eklemek istediğiniz notlar, özel koşullar..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3.5 rounded-xl transition-colors text-base"
          >
            {saving ? "Gönderiliyor..." : "Teklifi Gönder"}
          </button>

          <p className="text-center text-xs text-gray-400">
            Bu form {supplier?.company_name} adına {buyerCompany} firmasına gönderilecektir.
          </p>
        </form>
      </div>
    </div>
  );
}

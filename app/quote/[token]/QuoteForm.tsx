"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Truck, CreditCard, MessageSquare, CheckCircle2, AlertCircle } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { formatMoney, getCurrencySymbol } from "@/lib/currency";

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

const inputClass = `
  w-full px-3 py-2 rounded-lg text-sm
  bg-white border transition-colors
  focus:outline-none focus:ring-2
`.trim();

const inputStyle = { borderColor: "#e6ddd4", color: "#111" };
const focusRingStyle = "focus:ring-[#d4c5b8] focus:border-[#c4b5a8]";

function FieldInput({
  type = "text",
  value,
  onChange,
  placeholder,
  onWheel,
}: {
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onWheel?: React.WheelEventHandler<HTMLInputElement>;
}) {
  return (
    <input
      type={type}
      min={type === "number" ? "0" : undefined}
      step={type === "number" ? "any" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onWheel={onWheel}
      placeholder={placeholder}
      className={`${inputClass} ${focusRingStyle}`}
      style={inputStyle}
    />
  );
}

export default function QuoteForm({
  token,
  recipientId,
  rfq,
  supplier,
  buyerCompany,
  buyerLogoUrl,
  items,
  currency = "USD",
}: {
  token: string;
  recipientId: string;
  rfq: { title: string; notes: string; deadline: string };
  supplier: { company_name: string; contact_name: string };
  buyerCompany: string;
  buyerLogoUrl?: string | null;
  items: RfqItem[];
  currency?: string;
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
          .map((qi) => {
            const unitPrice = Math.round(parseFloat(qi.unit_price) * 1e6) / 1e6;
            const qty = items.find((i) => i.id === qi.rfq_item_id)?.quantity || 1;
            return {
              ...qi,
              unit_price: unitPrice,
              total_price: Math.round(unitPrice * qty * 1e6) / 1e6,
            };
          }),
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
  const isOverdue = deadline ? deadline < new Date() : false;

  return (
    <div className="min-h-screen" style={{ background: "#faf4ee" }}>
      {/* Buyer identity bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e6ddd4" }}>
        <div className="max-w-3xl mx-auto px-4 py-4 flex flex-col items-center gap-1">
          {buyerLogoUrl ? (
            <img
              src={buyerLogoUrl}
              alt={buyerCompany}
              className="h-10 object-contain"
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ background: "#8b3a2a" }}
            >
              {buyerCompany.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
          )}
          <p className="text-xs" style={{ color: "#7a6e67" }}>
            <strong style={{ color: "#111" }}>{buyerCompany}</strong> firması teklif talebinde bulunuyor
          </p>
        </div>
      </div>

      {/* RFQ info header */}
      <div style={{ background: "#111" }}>
        <div className="max-w-3xl mx-auto px-4 py-5">
          <p className="text-xs tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em" }}>
            {APP_NAME} · TEKLİF TALEBİ
          </p>
          <h1 className="text-xl font-semibold text-white leading-snug">{rfq.title}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              Alıcı: <span style={{ color: "rgba(255,255,255,0.85)" }}>{buyerCompany}</span>
            </span>
            {deadline && (
              <span className="text-xs flex items-center gap-1" style={{ color: isOverdue ? "#f87171" : "rgba(255,255,255,0.5)" }}>
                {isOverdue && <AlertCircle className="w-3 h-3" />}
                Son tarih: <span style={{ color: isOverdue ? "#f87171" : "rgba(255,255,255,0.85)" }}>{deadline.toLocaleDateString("tr-TR")}</span>
              </span>
            )}
          </div>
          {rfq.notes && (
            <div className="mt-3 text-xs rounded-lg px-3 py-2 inline-block" style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
              {rfq.notes}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Product list */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" style={{ color: "#7a6e67" }} />
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>
                  Ürün Listesi
                </h2>
                <span
                  className="text-xs font-mono px-1.5 py-0.5 rounded-sm"
                  style={{ background: "#e6ddd4", color: "#7a6e67" }}
                >
                  {items.length}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: "#b0a49e" }}>
                Fiyat verebileceğiniz ürünleri doldurun. Temin edemediğiniz ürünleri boş bırakabilirsiniz.
              </p>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>ÜRÜN</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>MİKTAR</th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>BİRİM FİYAT ({getCurrencySymbol(currency)}) *</th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>MARKA</th>
                    <th className="px-3 py-3 text-xs font-semibold tracking-wider text-center" style={{ color: "#7a6e67" }}>STOK</th>
                    <th className="px-4 py-3 text-xs font-semibold tracking-wider" style={{ color: "#7a6e67" }}>NOT</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f0e8e0", background: isEven ? "#fff" : "#fdfaf7" }}>
                        <td className="px-5 py-4 align-top">
                          <div className="font-medium" style={{ color: "#111" }}>{item.product_name}</div>
                          {item.brand && (
                            <div className="text-xs mt-0.5" style={{ color: "#b0a49e" }}>İstenen: {item.brand}</div>
                          )}
                          {item.impa_code && (
                            <div className="text-xs" style={{ color: "#b0a49e" }}>IMPA: {item.impa_code}</div>
                          )}
                          {item.detailed_description && (
                            <div className="text-xs mt-1 px-2 py-1 rounded" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                              {item.detailed_description}
                            </div>
                          )}
                          {item.photo_urls && item.photo_urls.length > 0 && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {item.photo_urls.map((url, pi) => (
                                <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt="Ürün fotoğrafı" className="w-10 h-10 object-cover rounded border transition-opacity hover:opacity-80" style={{ borderColor: "#e6ddd4" }} />
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right align-top tabular-nums" style={{ color: "#7a6e67" }}>
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-4 py-4 align-top w-32">
                          <FieldInput
                            type="number"
                            value={quoteItems[idx].unit_price}
                            onChange={(v) => updateItem(idx, "unit_price", v)}
                            onWheel={(e) => (e.target as HTMLElement).blur()}
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-4 py-4 align-top w-32">
                          <FieldInput
                            value={quoteItems[idx].offered_brand}
                            onChange={(v) => updateItem(idx, "offered_brand", v)}
                            placeholder="Marka"
                          />
                        </td>
                        <td className="px-3 py-4 align-top text-center">
                          <input
                            type="checkbox"
                            checked={quoteItems[idx].in_stock}
                            onChange={(e) => updateItem(idx, "in_stock", e.target.checked)}
                            className="w-4 h-4 rounded cursor-pointer accent-[#111]"
                          />
                        </td>
                        <td className="px-4 py-4 align-top w-36">
                          <FieldInput
                            value={quoteItems[idx].notes}
                            onChange={(v) => updateItem(idx, "notes", v)}
                            placeholder="Ek not..."
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden">
              {items.map((item, idx) => {
                const isLast = idx === items.length - 1;
                return (
                  <div
                    key={item.id}
                    className="px-4 py-5 space-y-3"
                    style={!isLast ? { borderBottom: "1px solid #f0e8e0" } : undefined}
                  >
                    {/* Product info */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className="text-xs font-mono px-1.5 py-0.5 rounded-sm mr-2"
                            style={{ background: "#f5f0eb", color: "#7a6e67" }}
                          >
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-sm" style={{ color: "#111" }}>{item.product_name}</span>
                        </div>
                        <span className="text-sm tabular-nums flex-shrink-0" style={{ color: "#7a6e67" }}>
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                      {item.brand && (
                        <p className="text-xs mt-0.5 ml-8" style={{ color: "#b0a49e" }}>İstenen marka: {item.brand}</p>
                      )}
                      {item.impa_code && (
                        <p className="text-xs ml-8" style={{ color: "#b0a49e" }}>IMPA: {item.impa_code}</p>
                      )}
                      {item.detailed_description && (
                        <div className="text-xs mt-1.5 px-2.5 py-1.5 rounded ml-8" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                          {item.detailed_description}
                        </div>
                      )}
                      {item.photo_urls && item.photo_urls.length > 0 && (
                        <div className="flex gap-1.5 mt-2 ml-8 flex-wrap">
                          {item.photo_urls.map((url, pi) => (
                            <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt="Ürün fotoğrafı" className="w-12 h-12 object-cover rounded border" style={{ borderColor: "#e6ddd4" }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Inputs */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "#7a6e67" }}>Birim Fiyat ({getCurrencySymbol(currency)}) *</label>
                        <FieldInput
                          type="number"
                          value={quoteItems[idx].unit_price}
                          onChange={(v) => updateItem(idx, "unit_price", v)}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "#7a6e67" }}>Sunulan Marka</label>
                        <FieldInput
                          value={quoteItems[idx].offered_brand}
                          onChange={(v) => updateItem(idx, "offered_brand", v)}
                          placeholder="Marka"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: "#7a6e67" }}>
                        <input
                          type="checkbox"
                          checked={quoteItems[idx].in_stock}
                          onChange={(e) => updateItem(idx, "in_stock", e.target.checked)}
                          className="w-4 h-4 rounded cursor-pointer accent-[#111]"
                        />
                        Stokta mevcut
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "#7a6e67" }}>Bu ürün için not</label>
                      <FieldInput
                        value={quoteItems[idx].notes}
                        onChange={(v) => updateItem(idx, "notes", v)}
                        placeholder="Ek not, alternatif öneri..."
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Running total */}
            {totalAmount > 0 && (
              <div
                className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: "1px solid #e6ddd4", background: "#faf4ee" }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>
                  Tahmini Toplam
                </span>
                <span className="text-sm font-bold tabular-nums" style={{ color: "#111" }}>
                  {formatMoney(totalAmount, currency)}
                </span>
              </div>
            )}
          </div>

          {/* Delivery & payment */}
          <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4" style={{ color: "#7a6e67" }} />
                <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>
                  Teslimat &amp; Ödeme
                </h2>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#7a6e67" }}>
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3 h-3" />
                      Teslimat Süresi
                    </span>
                  </label>
                  <FieldInput
                    value={deliveryTime}
                    onChange={setDeliveryTime}
                    placeholder="Örn: 3-5 iş günü"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#7a6e67" }}>
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3 h-3" />
                      Ödeme Koşulları
                    </span>
                  </label>
                  <FieldInput
                    value={paymentTerms}
                    onChange={setPaymentTerms}
                    placeholder="Örn: Peşin, 30 gün vadeli"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#7a6e67" }}>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" />
                    Genel Notlar
                  </span>
                </label>
                <textarea
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  placeholder="Eklemek istediğiniz notlar, özel koşullar, geçerlilik süresi..."
                  rows={3}
                  className={`${inputClass} ${focusRingStyle} resize-none`}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
              style={{ background: "#fdf0ee", color: "#8b3a2a", border: "1px solid #f5d0c8" }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 font-semibold py-4 rounded-xl text-sm transition-opacity disabled:opacity-60 hover:opacity-90"
            style={{ background: "#111", color: "#fff" }}
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Gönderiliyor…
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Teklifi Gönder
              </>
            )}
          </button>

          <p className="text-center text-xs" style={{ color: "#b0a49e" }}>
            Bu form <strong style={{ color: "#7a6e67" }}>{supplier?.company_name}</strong> adına{" "}
            <strong style={{ color: "#7a6e67" }}>{buyerCompany}</strong> firmasına gönderilecektir.
          </p>
        </form>
      </div>
    </div>
  );
}

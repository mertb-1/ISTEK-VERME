"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Clock, Mail, XCircle, AlertTriangle, Trophy, Package, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type RfqItem = { id: string; product_name: string; brand: string; quantity: number; unit: string };
type QuoteItem = { rfq_item_id: string; unit_price: number; total_price: number; offered_brand: string; in_stock: boolean; notes: string };
type Quote = { id: string; total_amount: number; delivery_time: string; payment_terms: string; supplier_notes: string; quote_items: QuoteItem[] };
type Supplier = { id: string; company_name: string; email: string; contact_name: string };
type Recipient = {
  id: string;
  status: string;
  magic_token: string;
  sent_at: string;
  responded_at: string;
  awarded_at: string | null;
  order_id: string | null;
  suppliers: Supplier | Supplier[];
  quotes: Quote[];
};

function getSupplier(r: Recipient): Supplier {
  return Array.isArray(r.suppliers) ? r.suppliers[0] : r.suppliers;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; bg: string; color: string }> = {
  sent:      { label: "Gönderildi",   icon: <Mail className="w-3 h-3" />,         bg: "#f5f0eb", color: "#7a6e67" },
  opened:    { label: "Açıldı",       icon: <Clock className="w-3 h-3" />,        bg: "#fef5e4", color: "#a06a00" },
  responded: { label: "Cevap Verdi",  icon: <CheckCircle className="w-3 h-3" />, bg: "#edf8f1", color: "#1a7a3a" },
  expired:   { label: "Süresi Geçti", icon: <XCircle className="w-3 h-3" />,     bg: "#fdf0ee", color: "#8b3a2a" },
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
  rfq: { id: string; title: string; status: string; deadline: string; notes: string; created_at: string; awarded_recipient_id: string | null };
  items: RfqItem[];
  recipients: Recipient[];
}) {
  const respondedRecipients = recipients.filter((r) => r.quotes && r.quotes.length > 0);
  const pendingRecipients = recipients.filter((r) => !r.quotes || r.quotes.length === 0);

  // Award state — başlangıç değeri veritabanından gelen rfq.awarded_recipient_id
  const [awardedRecipientId, setAwardedRecipientId] = useState<string | null>(rfq.awarded_recipient_id);
  const [awardedOrderId, setAwardedOrderId] = useState<string | null>(
    recipients.find((r) => r.order_id)?.order_id ?? null
  );

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRecipient, setDialogRecipient] = useState<Recipient | null>(null);
  const [poNote, setPoNote] = useState("");
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [awarding, setAwarding] = useState(false);
  const [awardError, setAwardError] = useState("");

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

  const cheapestSupplierRecipient = respondedRecipients.length > 0
    ? respondedRecipients.reduce((cheapest, r) => {
        const t = r.quotes?.[0]?.total_amount ?? Infinity;
        const ct = cheapest.quotes?.[0]?.total_amount ?? Infinity;
        return t < ct ? r : cheapest;
      })
    : null;

  const isOpen = rfq.status === "open";
  const deadline = rfq.deadline ? new Date(rfq.deadline) : null;
  const isOverdue = deadline && deadline < new Date() && isOpen;

  function openAwardDialog(r: Recipient) {
    setDialogRecipient(r);
    setPoNote("");
    setExpectedDelivery("");
    setAwardError("");
    setDialogOpen(true);
  }

  async function handleConfirmAward() {
    if (!dialogRecipient) return;
    const quote = dialogRecipient.quotes?.[0];
    if (!quote) return;

    setAwarding(true);
    setAwardError("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfq_id: rfq.id,
          rfq_recipient_id: dialogRecipient.id,
          quote_id: quote.id,
          confirmation_note: poNote || undefined,
          expected_delivery: expectedDelivery || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAwardError(data.error ?? "Sipariş oluşturulamadı.");
        return;
      }

      setAwardedRecipientId(dialogRecipient.id);
      setAwardedOrderId(data.order_id);
      setDialogOpen(false);
    } catch {
      setAwardError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setAwarding(false);
    }
  }

  return (
    <div className="p-8 max-w-full">
      {/* Breadcrumb + header */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 mb-3">
          <Link href="/rfq" className="text-xs tracking-widest transition-colors" style={{ color: "#b0a49e", letterSpacing: "0.1em" }}>
            TEKLİFLER
          </Link>
          <span className="text-xs" style={{ color: "#d0c8c0" }}>/</span>
          <span className="text-xs tracking-widest truncate max-w-xs" style={{ color: "#7a6e67", letterSpacing: "0.1em" }}>
            {rfq.title.toUpperCase()}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-mono" style={{ color: "#b0a49e" }}>
                TKF-{rfq.id.slice(0, 8).toUpperCase()}
              </span>
              <span
                className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
                style={{
                  background: isOpen ? "#fdf0ee" : "#f5f0eb",
                  color: isOpen ? "#8b3a2a" : "#7a6e67",
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: isOpen ? "#c0392b" : "#aaa" }} />
                {isOpen ? "Açık" : "Kapalı"}
              </span>
            </div>
            <h1 className="font-display text-4xl leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#111" }}>
              {rfq.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                Oluşturuldu: {new Date(rfq.created_at).toLocaleDateString("tr-TR")}
              </span>
              {deadline && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{
                  background: isOverdue ? "#fdf0ee" : "#f5f0eb",
                  color: isOverdue ? "#c0392b" : "#7a6e67",
                }}>
                  {isOverdue && <AlertTriangle className="w-3 h-3" />}
                  Son tarih: {deadline.toLocaleDateString("tr-TR")}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                <Package className="w-3 h-3" />
                {items.length} kalem
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                <Mail className="w-3 h-3" />
                {recipients.length} tedarikçi
              </span>
            </div>
            {rfq.notes && (
              <p className="text-sm mt-3 px-3 py-2 rounded-lg inline-block" style={{ background: "#f5f0eb", color: "#7a6e67" }}>{rfq.notes}</p>
            )}
          </div>
        </div>
      </div>

      {/* Award success banner */}
      {awardedRecipientId && awardedOrderId && (() => {
        const awardedR = recipients.find((r) => r.id === awardedRecipientId);
        const awardedSupplier = awardedR ? getSupplier(awardedR) : null;
        return (
          <div
            className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl mb-6"
            style={{ background: "#edf8f1", border: "1px solid #c3e6cb" }}
          >
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#1a7a3a" }} />
              <div>
                <div className="text-sm font-semibold" style={{ color: "#1a7a3a" }}>
                  Sipariş oluşturuldu — {awardedSupplier?.company_name}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "#1a7a3a", opacity: 0.75 }}>
                  Teklif talebi kapatıldı. Sipariş detaylarını görüntüleyebilirsiniz.
                </div>
              </div>
            </div>
            <Link
              href={`/orders/${awardedOrderId}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg flex-shrink-0 transition-colors"
              style={{ background: "#1a7a3a", color: "#fff" }}
            >
              Siparişi Görüntüle
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        );
      })()}

      {/* Tedarikçi durumları — mini satır */}
      {recipients.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {recipients.map((r) => {
            const s = getSupplier(r);
            const cfg = statusConfig[r.status] ?? statusConfig.sent;
            return (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded"
                style={{ background: cfg.bg, color: cfg.color }}
              >
                {cfg.icon}
                {s?.company_name}
              </span>
            );
          })}
        </div>
      )}

      {/* No responses yet */}
      {respondedRecipients.length === 0 ? (
        <div className="rounded-xl px-6 py-20 text-center" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "#f5f0eb" }}>
            <Clock className="w-6 h-6" style={{ color: "#7a6e67" }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: "#111" }}>Henüz cevap gelmedi</p>
          <p className="text-sm" style={{ color: "#7a6e67" }}>Tedarikçiler mail içindeki link üzerinden fiyat girecek.</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          {/* Table toolbar */}
          <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap" style={{ borderBottom: "1px solid #e6ddd4" }}>
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-sm" style={{ color: "#111" }}>KARŞILAŞTIRMA TABLOSU</h2>
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                {respondedRecipients.length}/{recipients.length} tedarikçi yanıtladı
              </span>
            </div>
            {cheapestMixTotal > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: "#edf8f1", border: "1px solid #c3e6cb" }}>
                <Trophy className="w-4 h-4" style={{ color: "#1a7a3a" }} />
                <span className="text-sm" style={{ color: "#1a7a3a" }}>
                  En ucuz karma: <span className="font-bold">{formatPrice(cheapestMixTotal)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}>
                  <th className="text-left px-5 py-4 font-medium min-w-[220px] sticky left-0 z-10" style={{ color: "#7a6e67", background: "#faf4ee", borderRight: "1px solid #e6ddd4" }}>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Ürün
                    </div>
                  </th>
                  {respondedRecipients.map((r) => {
                    const s = getSupplier(r);
                    const isOverallCheapest = cheapestSupplierRecipient?.id === r.id;
                    const isAwarded = awardedRecipientId === r.id;
                    return (
                      <th key={r.id} className="text-center px-4 py-3 min-w-[180px]" style={{
                        borderRight: "1px solid #e6ddd4",
                        background: isAwarded ? "#edf8f1" : undefined,
                      }}>
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap justify-center">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#f5ede6", color: "#8b3a2a" }}>
                              {getInitials(s?.company_name ?? "?")}
                            </div>
                            <span className="font-semibold text-sm" style={{ color: "#111" }}>{s?.company_name}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap justify-center">
                            {isAwarded && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#edf8f1", color: "#1a7a3a" }}>
                                <CheckCircle className="w-3 h-3" />
                                Seçildi
                              </span>
                            )}
                            {!isAwarded && isOverallCheapest && respondedRecipients.length > 1 && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ background: "#fef5e4", color: "#a06a00" }}>
                                <Trophy className="w-3 h-3" />
                                En ucuz
                              </span>
                            )}
                            {r.quotes?.[0]?.delivery_time && (
                              <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>{r.quotes[0].delivery_time}</span>
                            )}
                            {r.quotes?.[0]?.payment_terms && (
                              <span className="inline-flex items-center text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>{r.quotes[0].payment_terms}</span>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}
                  {pendingRecipients.map((r) => {
                    const s = getSupplier(r);
                    return (
                      <th key={r.id} className="text-center px-4 py-3 min-w-[140px]" style={{ borderRight: "1px solid #e6ddd4", opacity: 0.4 }}>
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#f5f0eb", color: "#b0a49e" }}>
                            {getInitials(s?.company_name ?? "?")}
                          </div>
                          <span className="font-medium text-sm" style={{ color: "#7a6e67" }}>{s?.company_name}</span>
                          <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
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
                    <tr key={item.id} style={{ borderBottom: "1px solid #f0e8e0", background: isEven ? "#fff" : "#faf4ee" }}>
                      <td className="px-5 py-4 sticky left-0 z-10" style={{ borderRight: "1px solid #e6ddd4", background: isEven ? "#fff" : "#faf4ee" }}>
                        <div className="font-medium leading-snug" style={{ color: "#111" }}>{item.product_name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 rounded" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                            {item.quantity} {item.unit}
                          </span>
                          {item.brand && (
                            <span className="text-xs" style={{ color: "#b0a49e" }}>{item.brand}</span>
                          )}
                        </div>
                      </td>

                      {respondedRecipients.map((r) => {
                        const qi = getPriceForItem(r, item.id);
                        const isCheapest = qi && minPrice !== null && qi.unit_price === minPrice;
                        const brandMatch = !qi?.offered_brand || !item.brand ||
                          qi.offered_brand.toLowerCase() === item.brand.toLowerCase();
                        const brandMismatch = qi?.offered_brand && item.brand && !brandMatch;
                        const isAwarded = awardedRecipientId === r.id;

                        return (
                          <td
                            key={r.id}
                            className="px-4 py-4 text-center"
                            style={{
                              borderRight: "1px solid #f0e8e0",
                              background: isAwarded ? "#edf8f1" : isCheapest ? "#edf8f1" : "transparent",
                              opacity: awardedRecipientId && !isAwarded ? 0.45 : 1,
                            }}
                          >
                            {qi ? (
                              <div className="space-y-1">
                                <div className="text-base font-bold tabular-nums" style={{ color: isCheapest ? "#1a7a3a" : "#111" }}>
                                  {formatPrice(qi.unit_price)}
                                  {isCheapest && respondedRecipients.length > 1 && (
                                    <span className="ml-1.5 inline-flex items-center" style={{ color: "#1a7a3a" }}>
                                      <CheckCircle className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs tabular-nums" style={{ color: "#b0a49e" }}>
                                  Toplam: {formatPrice(qi.unit_price * item.quantity)}
                                </div>
                                {qi.offered_brand && (
                                  <div
                                    className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                                    style={brandMismatch
                                      ? { background: "#fef5e4", color: "#a06a00" }
                                      : { background: "#f5f0eb", color: "#7a6e67" }}
                                  >
                                    {brandMismatch ? (
                                      <><AlertTriangle className="w-3 h-3" /> {qi.offered_brand}</>
                                    ) : (
                                      <><CheckCircle className="w-3 h-3" style={{ color: "#b0a49e" }} /> {qi.offered_brand}</>
                                    )}
                                  </div>
                                )}
                                {!qi.in_stock && (
                                  <div className="text-xs font-medium" style={{ color: "#8b3a2a" }}>Stokta yok</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#d0c8c0", fontSize: 18 }}>—</span>
                            )}
                          </td>
                        );
                      })}

                      {pendingRecipients.map((r) => (
                        <td key={r.id} className="px-4 py-4 text-center opacity-30" style={{ borderRight: "1px solid #f0e8e0" }}>
                          <span style={{ color: "#b0a49e", fontSize: 18 }}>—</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* TOPLAM row */}
                <tr style={{ borderTop: "2px solid #e6ddd4", background: "#faf4ee" }}>
                  <td className="px-5 py-4 sticky left-0 z-10" style={{ background: "#faf4ee", borderRight: "1px solid #e6ddd4" }}>
                    <div className="font-bold text-sm uppercase tracking-wider" style={{ color: "#111" }}>Toplam</div>
                    <div className="text-xs mt-0.5 font-normal" style={{ color: "#7a6e67" }}>Tedarikçi toplamı</div>
                  </td>
                  {respondedRecipients.map((r) => {
                    const total = r.quotes?.[0]?.total_amount;
                    const isOverallCheapest = cheapestSupplierRecipient?.id === r.id && respondedRecipients.length > 1;
                    const isAwarded = awardedRecipientId === r.id;
                    return (
                      <td key={r.id} className="px-4 py-4 text-center" style={{
                        borderRight: "1px solid #f0e8e0",
                        background: isAwarded ? "#edf8f1" : isOverallCheapest ? "#edf8f1" : "transparent",
                        opacity: awardedRecipientId && !isAwarded ? 0.45 : 1,
                      }}>
                        <div className="text-xl font-bold tabular-nums" style={{ color: isOverallCheapest ? "#1a7a3a" : "#111" }}>
                          {formatPrice(total)}
                        </div>
                        {isOverallCheapest && !isAwarded && (
                          <div className="mt-1 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "#fef5e4", color: "#a06a00" }}>
                            <Trophy className="w-3 h-3" />
                            En ucuz
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {pendingRecipients.map((r) => (
                    <td key={r.id} className="px-4 py-4 text-center opacity-30" style={{ borderRight: "1px solid #f0e8e0" }}>
                      <span style={{ color: "#b0a49e" }}>—</span>
                    </td>
                  ))}
                </tr>

              </tbody>
            </table>
          </div>

          {/* Supplier notes */}
          {respondedRecipients.some((r) => r.quotes?.[0]?.supplier_notes) && (
            <div className="px-6 py-5" style={{ borderTop: "1px solid #e6ddd4", background: "#faf4ee" }}>
              <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#7a6e67" }}>Tedarikçi Notları</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {respondedRecipients.map((r) => {
                  const note = r.quotes?.[0]?.supplier_notes;
                  if (!note) return null;
                  return (
                    <div key={r.id} className="rounded-lg px-4 py-3" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
                      <div className="text-xs font-semibold mb-1" style={{ color: "#111" }}>{getSupplier(r)?.company_name}</div>
                      <div className="text-sm" style={{ color: "#7a6e67" }}>{note}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cheapest mix summary */}
          {cheapestMixTotal > 0 && respondedRecipients.length > 1 && (
            <div className="px-6 py-5" style={{ borderTop: "1px solid #e6ddd4", background: "#fff" }}>
              <div className="rounded-xl px-5 py-4" style={{ background: "#edf8f1", border: "1px solid #c3e6cb" }}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "#d4f0de" }}>
                      <Trophy className="w-4 h-4" style={{ color: "#1a7a3a" }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "#1a7a3a" }}>En Ucuz Karma</div>
                      <div className="text-xs mt-0.5" style={{ color: "#1a7a3a", opacity: 0.75 }}>
                        Her üründe en düşük birim fiyatı seçerek elde edilebilecek teorik minimum tutar
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-start sm:items-end gap-1 sm:pl-4 flex-shrink-0">
                    <span className="text-2xl font-bold tabular-nums" style={{ color: "#1a7a3a" }}>
                      {formatPrice(cheapestMixTotal)}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {items.map((item) => {
                        const minPrice = getMinPriceForItem(item.id);
                        if (!minPrice) return null;
                        const cheapestR = respondedRecipients.find(
                          (r) => getPriceForItem(r, item.id)?.unit_price === minPrice
                        );
                        const supplierName = cheapestR ? getSupplier(cheapestR)?.company_name : null;
                        return (
                          <span key={item.id} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#d4f0de", color: "#1a7a3a" }}>
                            {item.product_name}
                            {supplierName && <span style={{ opacity: 0.7 }}>· {supplierName}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Select supplier row */}
          <div className="px-6 py-5" style={{ borderTop: "2px solid #e6ddd4", background: "#faf4ee" }}>
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              <span className="text-sm font-medium flex-shrink-0" style={{ color: "#7a6e67" }}>
                {awardedRecipientId ? "Sipariş verildi:" : "Tedarikçi seç:"}
              </span>
              {respondedRecipients.map((r) => {
                const s = getSupplier(r);
                const isOverallCheapest = cheapestSupplierRecipient?.id === r.id && respondedRecipients.length > 1;
                const isAwarded = awardedRecipientId === r.id;
                const isDisabled = !!awardedRecipientId;

                if (isAwarded) {
                  return (
                    <Link
                      key={r.id}
                      href={`/orders/${awardedOrderId}`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-shrink-0 transition-colors"
                      style={{ background: "#1a7a3a", color: "#fff", border: "1px solid #1a7a3a" }}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {s?.company_name}
                      <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {formatPrice(r.quotes?.[0]?.total_amount)}
                      </span>
                    </Link>
                  );
                }

                return (
                  <button
                    key={r.id}
                    onClick={() => openAwardDialog(r)}
                    disabled={isDisabled}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={isOverallCheapest
                      ? { background: "#111", color: "#fff", borderColor: "#111" }
                      : { background: "#fff", color: "#111", borderColor: "#e6ddd4" }}
                  >
                    {isOverallCheapest && <Trophy className="w-3.5 h-3.5" />}
                    {s?.company_name}
                    <span className="text-xs font-normal" style={{ color: isOverallCheapest ? "rgba(255,255,255,0.6)" : "#7a6e67" }}>
                      {formatPrice(r.quotes?.[0]?.total_amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Award confirmation dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!awarding) setDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Sipariş Oluştur</DialogTitle>
          </DialogHeader>

          {dialogRecipient && (() => {
            const s = getSupplier(dialogRecipient);
            const q = dialogRecipient.quotes?.[0];
            return (
              <div className="space-y-4 py-2">
                {/* Özet */}
                <div className="rounded-lg px-4 py-3 space-y-2 text-sm" style={{ background: "#f5f0eb" }}>
                  <div className="flex justify-between">
                    <span style={{ color: "#7a6e67" }}>Tedarikçi</span>
                    <span className="font-semibold" style={{ color: "#111" }}>{s?.company_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: "#7a6e67" }}>Teklif Tutarı</span>
                    <span className="font-bold" style={{ color: "#111" }}>{formatPrice(q?.total_amount)}</span>
                  </div>
                  {q?.delivery_time && (
                    <div className="flex justify-between">
                      <span style={{ color: "#7a6e67" }}>Teslimat</span>
                      <span style={{ color: "#111" }}>{q.delivery_time}</span>
                    </div>
                  )}
                  {q?.payment_terms && (
                    <div className="flex justify-between">
                      <span style={{ color: "#7a6e67" }}>Ödeme</span>
                      <span style={{ color: "#111" }}>{q.payment_terms}</span>
                    </div>
                  )}
                </div>

                {/* Beklenen teslimat */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium" style={{ color: "#111" }}>
                    Beklenen Teslimat Tarihi <span style={{ color: "#b0a49e" }}>(opsiyonel)</span>
                  </label>
                  <input
                    type="date"
                    value={expectedDelivery}
                    onChange={(e) => setExpectedDelivery(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#d4c5b8]"
                    style={{ borderColor: "#e6ddd4" }}
                  />
                </div>

                {/* PO notu */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium" style={{ color: "#111" }}>
                    PO Notu <span style={{ color: "#b0a49e" }}>(opsiyonel)</span>
                  </label>
                  <textarea
                    value={poNote}
                    onChange={(e) => setPoNote(e.target.value)}
                    placeholder="Tedarikçiye iletilecek sipariş notu..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#d4c5b8] resize-none"
                    style={{ borderColor: "#e6ddd4" }}
                  />
                </div>

                {awardError && (
                  <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "#fdf0ee", color: "#8b3a2a" }}>
                    {awardError}
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={awarding}
            >
              İptal
            </Button>
            <Button
              type="button"
              onClick={handleConfirmAward}
              disabled={awarding}
              style={{ background: "#111", color: "#fff" }}
            >
              {awarding ? "Oluşturuluyor..." : "Sipariş Oluştur →"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

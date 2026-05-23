"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Clock, Mail, AlertTriangle, Trophy, Package, ExternalLink, Layers } from "lucide-react";
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

function formatPrice(n: number | null | undefined) {
  if (!n) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

type SplitOrder = { rfq_recipient_id: string; order_id: string };

export default function RfqDetail({
  rfq,
  items,
  recipients,
}: {
  rfq: { id: string; title: string; status: string; deadline: string; notes: string; created_at: string; awarded_recipient_id: string | null; split_awarded: boolean };
  items: RfqItem[];
  recipients: Recipient[];
}) {
  const respondedRecipients = recipients.filter((r) => r.quotes && r.quotes.length > 0);
  const pendingRecipients = recipients.filter((r) => !r.quotes || r.quotes.length === 0);

  const [awardedRecipientId, setAwardedRecipientId] = useState<string | null>(rfq.awarded_recipient_id);
  const [awardedOrderId, setAwardedOrderId] = useState<string | null>(
    recipients.find((r) => r.order_id)?.order_id ?? null
  );

  // Split-award state
  const initialSplitOrders: SplitOrder[] = rfq.split_awarded
    ? recipients.filter((r) => r.order_id).map((r) => ({ rfq_recipient_id: r.id, order_id: r.order_id! }))
    : [];
  const [splitAwardedOrders, setSplitAwardedOrders] = useState<SplitOrder[]>(initialSplitOrders);
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitAwarding, setSplitAwarding] = useState(false);
  const [splitAwardError, setSplitAwardError] = useState("");
  const [splitNote, setSplitNote] = useState("");
  const [splitDelivery, setSplitDelivery] = useState("");

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

  // Build cheapest-mix awards array (one entry per item)
  const cheapestMixAwards: Array<{ rfq_item_id: string; rfq_recipient_id: string }> = [];
  for (const item of items) {
    let cheapestR: Recipient | null = null;
    let cheapestPrice = Infinity;
    for (const r of respondedRecipients) {
      const qi = getPriceForItem(r, item.id);
      if (qi && qi.unit_price > 0 && qi.unit_price < cheapestPrice) {
        cheapestPrice = qi.unit_price;
        cheapestR = r;
      }
    }
    if (cheapestR) {
      cheapestMixAwards.push({ rfq_item_id: item.id, rfq_recipient_id: cheapestR.id });
    }
  }
  const cheapestMixValid = cheapestMixAwards.length === items.length && items.length > 0;

  // Group awards by supplier for dialog preview
  const splitAwardsGrouped: Record<string, { supplier: Supplier; itemNames: string[] }> = {};
  for (const award of cheapestMixAwards) {
    if (!splitAwardsGrouped[award.rfq_recipient_id]) {
      const r = respondedRecipients.find((x) => x.id === award.rfq_recipient_id);
      if (r) splitAwardsGrouped[award.rfq_recipient_id] = { supplier: getSupplier(r), itemNames: [] };
    }
    const itemName = items.find((i) => i.id === award.rfq_item_id)?.product_name ?? award.rfq_item_id;
    if (splitAwardsGrouped[award.rfq_recipient_id]) {
      splitAwardsGrouped[award.rfq_recipient_id].itemNames.push(itemName);
    }
  }

  const isOpen = rfq.status === "open";
  const rfqClosed = !!awardedRecipientId || splitAwardedOrders.length > 0;
  const deadline = rfq.deadline ? new Date(rfq.deadline) : null;
  const isOverdue = deadline && deadline < new Date() && isOpen;

  async function handleConfirmSplitAward() {
    if (!cheapestMixValid) {
      setSplitAwardError("Bazı ürünler için fiyat bulunamadı. Tüm ürünlerin fiyatlandırılmış olması gerekiyor.");
      return;
    }
    setSplitAwarding(true);
    setSplitAwardError("");
    try {
      const res = await fetch("/api/orders/split-award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rfq_id: rfq.id,
          awards: cheapestMixAwards,
          buyer_note: splitNote || undefined,
          expected_delivery: splitDelivery || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSplitAwardError(data.error ?? "Sipariş oluşturulamadı.");
        return;
      }
      setSplitAwardedOrders(data.orders as SplitOrder[]);
      setSplitDialogOpen(false);
    } catch {
      setSplitAwardError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setSplitAwarding(false);
    }
  }

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
    <div className="w-full max-w-[1440px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <div className="flex items-center gap-1.5 mb-3">
          <Link href="/rfq" className="text-xs tracking-widest transition-colors hover:text-[#111]" style={{ color: "#b0a49e", letterSpacing: "0.1em" }}>
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
            <h1 className="text-3xl font-semibold leading-tight mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#111" }}>
              {rfq.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
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
            className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl mb-5"
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

      {/* Split-award success banner */}
      {splitAwardedOrders.length > 0 && (
        <div
          className="flex items-start justify-between gap-4 px-5 py-4 rounded-xl mb-5"
          style={{ background: "#edf8f1", border: "1px solid #c3e6cb" }}
        >
          <div className="flex items-start gap-3">
            <Layers className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#1a7a3a" }} />
            <div>
              <div className="text-sm font-semibold" style={{ color: "#1a7a3a" }}>
                Parçalı sipariş oluşturuldu — {splitAwardedOrders.length} tedarikçi
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#1a7a3a", opacity: 0.75 }}>
                Teklif talebi kapatıldı. Her tedarikçi için ayrı sipariş oluşturuldu.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {splitAwardedOrders.map(({ rfq_recipient_id, order_id }) => {
              const r = recipients.find((x) => x.id === rfq_recipient_id);
              const s = r ? getSupplier(r) : null;
              return (
                <Link
                  key={order_id}
                  href={`/orders/${order_id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-colors"
                  style={{ background: "#1a7a3a", color: "#fff" }}
                >
                  {s?.company_name ?? "Sipariş"}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending suppliers */}
      {pendingRecipients.length > 0 && (
        <div className="rounded-xl px-5 py-3.5 mb-5" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#b0a49e" }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#b0a49e" }}>
              Cevap Bekleniyor · {pendingRecipients.length} tedarikçi
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingRecipients.map((r) => {
              const s = getSupplier(r);
              const sentDate = r.sent_at
                ? new Date(r.sent_at).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
                : null;
              return (
                <div
                  key={r.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: "#f5f0eb", border: "1px solid #e6ddd4" }}
                >
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#e6ddd4", color: "#7a6e67" }}>
                    {getInitials(s?.company_name ?? "?")}
                  </div>
                  <span className="text-xs font-medium" style={{ color: "#111" }}>{s?.company_name}</span>
                  {sentDate && (
                    <span className="text-xs" style={{ color: "#b0a49e" }}>· {sentDate} gönderildi</span>
                  )}
                </div>
              );
            })}
          </div>
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
          <div className="px-5 py-3.5 flex items-center justify-between gap-4 flex-wrap" style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>Karşılaştırma Tablosu</span>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#e6ddd4", color: "#7a6e67" }}>
                {respondedRecipients.length}/{recipients.length} yanıtladı
              </span>
            </div>
            {cheapestMixTotal > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: "#edf8f1", border: "1px solid #c3e6cb" }}>
                <Trophy className="w-3.5 h-3.5" style={{ color: "#1a7a3a" }} />
                <span className="text-xs" style={{ color: "#1a7a3a" }}>
                  En ucuz karma: <span className="font-bold">{formatPrice(cheapestMixTotal)}</span>
                </span>
              </div>
            )}
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid #e6ddd4" }}>
                  {/* Product column header */}
                  <th
                    className="text-left px-5 py-3 min-w-[220px] sticky left-0 z-10"
                    style={{ background: "#faf4ee", borderRight: "1px solid #e6ddd4" }}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>Ürün</span>
                  </th>

                  {/* Responded supplier headers */}
                  {respondedRecipients.map((r) => {
                    const s = getSupplier(r);
                    const isOverallCheapest = cheapestSupplierRecipient?.id === r.id;
                    const isAwarded = awardedRecipientId === r.id;
                    return (
                      <th
                        key={r.id}
                        className="px-4 py-3 min-w-[176px]"
                        style={{
                          borderRight: "1px solid #e6ddd4",
                          background: isAwarded ? "#edf8f1" : "#faf4ee",
                          verticalAlign: "top",
                        }}
                      >
                        {/* Supplier card inside header */}
                        <div className="flex flex-col items-center gap-1.5 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: "#f5ede6", color: "#8b3a2a" }}
                            >
                              {getInitials(s?.company_name ?? "?")}
                            </div>
                            <span className="font-semibold text-sm leading-snug" style={{ color: "#111" }}>
                              {s?.company_name}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center justify-center gap-1">
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
                              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                                {r.quotes[0].delivery_time}
                              </span>
                            )}
                            {r.quotes?.[0]?.payment_terms && (
                              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                                {r.quotes[0].payment_terms}
                              </span>
                            )}
                          </div>
                        </div>
                      </th>
                    );
                  })}

                  {/* Pending supplier headers */}
                  {pendingRecipients.map((r) => {
                    const s = getSupplier(r);
                    return (
                      <th
                        key={r.id}
                        className="px-4 py-3 min-w-[140px]"
                        style={{ borderRight: "1px solid #e6ddd4", background: "#faf4ee", opacity: 0.45, verticalAlign: "top" }}
                      >
                        <div className="flex flex-col items-center gap-1.5 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#f5f0eb", color: "#b0a49e" }}>
                              {getInitials(s?.company_name ?? "?")}
                            </div>
                            <span className="font-medium text-sm" style={{ color: "#7a6e67" }}>{s?.company_name}</span>
                          </div>
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
                    <tr key={item.id} style={{ borderBottom: "1px solid #f0e8e0", background: isEven ? "#fff" : "#fdfaf7" }}>
                      {/* Sticky product column */}
                      <td
                        className="px-5 py-3 sticky left-0 z-10"
                        style={{ borderRight: "1px solid #e6ddd4", background: isEven ? "#fff" : "#fdfaf7" }}
                      >
                        <div className="font-medium text-sm leading-snug" style={{ color: "#111" }}>{item.product_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                            {item.quantity} {item.unit}
                          </span>
                          {item.brand && (
                            <span className="text-xs" style={{ color: "#b0a49e" }}>{item.brand}</span>
                          )}
                        </div>
                      </td>

                      {/* Price cells for responded suppliers */}
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
                            className="px-4 py-3 text-center"
                            style={{
                              borderRight: "1px solid #f0e8e0",
                              background: isAwarded ? "#f0fbf4" : isCheapest ? "#f0fbf4" : "transparent",
                              opacity: awardedRecipientId && !isAwarded ? 0.4 : 1,
                            }}
                          >
                            {qi ? (
                              <div className="space-y-1">
                                <div className="text-base font-bold tabular-nums leading-none" style={{ color: isCheapest ? "#1a7a3a" : "#111" }}>
                                  {formatPrice(qi.unit_price)}
                                  {isCheapest && respondedRecipients.length > 1 && (
                                    <span className="ml-1 inline-flex items-center" style={{ color: "#1a7a3a" }}>
                                      <CheckCircle className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs tabular-nums" style={{ color: "#b0a49e" }}>
                                  = {formatPrice(qi.unit_price * item.quantity)}
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
                                      <>{qi.offered_brand}</>
                                    )}
                                  </div>
                                )}
                                {!qi.in_stock && (
                                  <div className="text-xs font-medium" style={{ color: "#8b3a2a" }}>Stokta yok</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: "#d0c8c0" }}>—</span>
                            )}
                          </td>
                        );
                      })}

                      {pendingRecipients.map((r) => (
                        <td key={r.id} className="px-4 py-3 text-center opacity-25" style={{ borderRight: "1px solid #f0e8e0" }}>
                          <span style={{ color: "#b0a49e" }}>—</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}

                {/* TOPLAM row — visually heavier */}
                <tr style={{ borderTop: "2px solid #e6ddd4", background: "#faf4ee" }}>
                  <td className="px-5 py-4 sticky left-0 z-10" style={{ background: "#faf4ee", borderRight: "1px solid #e6ddd4" }}>
                    <div className="font-bold text-sm uppercase tracking-wider" style={{ color: "#111" }}>Toplam</div>
                    <div className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>Tedarikçi toplamı</div>
                  </td>
                  {respondedRecipients.map((r) => {
                    const total = r.quotes?.[0]?.total_amount;
                    const isOverallCheapest = cheapestSupplierRecipient?.id === r.id && respondedRecipients.length > 1;
                    const isAwarded = awardedRecipientId === r.id;
                    return (
                      <td
                        key={r.id}
                        className="px-4 py-4 text-center"
                        style={{
                          borderRight: "1px solid #e6ddd4",
                          background: isAwarded ? "#e3f5eb" : isOverallCheapest ? "#e3f5eb" : "#faf4ee",
                          opacity: awardedRecipientId && !isAwarded ? 0.4 : 1,
                        }}
                      >
                        <div
                          className="text-2xl font-bold tabular-nums leading-none"
                          style={{ color: isOverallCheapest ? "#1a7a3a" : "#111" }}
                        >
                          {formatPrice(total)}
                        </div>
                        {isOverallCheapest && !isAwarded && (
                          <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fef5e4", color: "#a06a00" }}>
                            <Trophy className="w-3 h-3" />
                            En ucuz
                          </div>
                        )}
                        {isAwarded && (
                          <div className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#d4f0de", color: "#1a7a3a" }}>
                            <CheckCircle className="w-3 h-3" />
                            Seçildi
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {pendingRecipients.map((r) => (
                    <td key={r.id} className="px-4 py-4 text-center opacity-25" style={{ borderRight: "1px solid #e6ddd4", background: "#faf4ee" }}>
                      <span style={{ color: "#b0a49e" }}>—</span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Supplier notes */}
          {respondedRecipients.some((r) => r.quotes?.[0]?.supplier_notes) && (
            <div className="px-5 py-4" style={{ borderTop: "1px solid #e6ddd4", background: "#faf4ee" }}>
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
            <div className="px-5 py-4" style={{ borderTop: "1px solid #e6ddd4" }}>
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
                  <div className="flex flex-col items-start sm:items-end gap-1.5 sm:pl-4 flex-shrink-0">
                    <span className="text-2xl font-bold tabular-nums" style={{ color: "#1a7a3a" }}>
                      {formatPrice(cheapestMixTotal)}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {items.map((item) => {
                        const minP = getMinPriceForItem(item.id);
                        if (!minP) return null;
                        const cheapestR = respondedRecipients.find(
                          (r) => getPriceForItem(r, item.id)?.unit_price === minP
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
                    {splitAwardedOrders.length === 0 && (rfq.split_awarded || rfqClosed) && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#d4f0de", color: "#1a7a3a" }}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Parçalı Sipariş Oluşturuldu
                      </span>
                    )}
                  </div>
                </div>
                {/* Split-award action button — full width row below the summary */}
                {isOpen && !rfqClosed && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid #b8e6c8" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSplitNote("");
                        setSplitDelivery("");
                        setSplitAwardError("");
                        setSplitDialogOpen(true);
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                      style={{ background: "#1a7a3a", color: "#fff" }}
                    >
                      <Layers className="w-4 h-4" />
                      En Ucuz Karma ile Sipariş Oluştur
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Award action row */}
          <div className="px-5 py-5" style={{ borderTop: "2px solid #e6ddd4", background: "#faf4ee" }}>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#7a6e67" }}>
              {rfqClosed ? "Sipariş Verildi" : "Tedarikçi Seç"}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {respondedRecipients.map((r) => {
                const s = getSupplier(r);
                const isOverallCheapest = cheapestSupplierRecipient?.id === r.id && respondedRecipients.length > 1;
                const isAwarded = awardedRecipientId === r.id;
                const isDisabled = rfqClosed;

                if (isAwarded) {
                  return (
                    <Link
                      key={r.id}
                      href={`/orders/${awardedOrderId}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 transition-opacity hover:opacity-90"
                      style={{ background: "#1a7a3a", color: "#fff" }}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {s?.company_name}
                      <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {formatPrice(r.quotes?.[0]?.total_amount)}
                      </span>
                      <ExternalLink className="w-3 h-3" style={{ color: "rgba(255,255,255,0.6)" }} />
                    </Link>
                  );
                }

                return (
                  <button
                    key={r.id}
                    onClick={() => openAwardDialog(r)}
                    disabled={isDisabled}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium flex-shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={isOverallCheapest
                      ? { background: "#111", color: "#fff", border: "1px solid #111" }
                      : { background: "#fff", color: "#111", border: "1px solid #e6ddd4" }}
                  >
                    {isOverallCheapest && <Trophy className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.7)" }} />}
                    {s?.company_name}
                    <span
                      className="text-xs font-normal tabular-nums"
                      style={{ color: isOverallCheapest ? "rgba(255,255,255,0.6)" : "#7a6e67" }}
                    >
                      {formatPrice(r.quotes?.[0]?.total_amount)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Split-award confirmation dialog */}
      <Dialog open={splitDialogOpen} onOpenChange={(open) => { if (!splitAwarding) setSplitDialogOpen(open); }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>En Ucuz Karma ile Sipariş Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm" style={{ color: "#7a6e67" }}>
              Her ürün için en uygun tedarikçiye ayrı sipariş oluşturulacak. Aynı anda birden fazla tedarikçiyle çalışılır.
            </p>
            {/* Supplier grouping preview */}
            <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #e6ddd4" }}>
              <div className="px-4 py-2.5" style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#7a6e67" }}>
                  Sipariş Dağılımı
                </span>
              </div>
              {Object.entries(splitAwardsGrouped).map(([recipientId, group]) => (
                <div key={recipientId} className="px-4 py-3" style={{ borderBottom: "1px solid #f0e8e0" }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#f5ede6", color: "#8b3a2a" }}>
                      {getInitials(group.supplier?.company_name ?? "?")}
                    </div>
                    <span className="text-sm font-semibold" style={{ color: "#111" }}>{group.supplier?.company_name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 pl-8">
                    {group.itemNames.map((name, i) => (
                      <span key={i} className="inline-flex text-xs px-1.5 py-0.5 rounded" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: "#faf4ee" }}>
                <span className="text-xs font-semibold" style={{ color: "#7a6e67" }}>Toplam</span>
                <span className="text-base font-bold tabular-nums" style={{ color: "#1a7a3a" }}>{formatPrice(cheapestMixTotal)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium" style={{ color: "#111" }}>
                Beklenen Teslimat Tarihi <span style={{ color: "#b0a49e" }}>(opsiyonel)</span>
              </label>
              <input
                type="date"
                value={splitDelivery}
                onChange={(e) => setSplitDelivery(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#d4c5b8]"
                style={{ borderColor: "#e6ddd4" }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium" style={{ color: "#111" }}>
                Sipariş Notu <span style={{ color: "#b0a49e" }}>(opsiyonel, tüm tedarikçilere iletilir)</span>
              </label>
              <textarea
                value={splitNote}
                onChange={(e) => setSplitNote(e.target.value)}
                placeholder="Tedarikçilere iletilecek sipariş notu..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-[#d4c5b8] resize-none"
                style={{ borderColor: "#e6ddd4" }}
              />
            </div>

            {splitAwardError && (
              <div className="text-sm px-3 py-2 rounded-lg" style={{ background: "#fdf0ee", color: "#8b3a2a" }}>
                {splitAwardError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSplitDialogOpen(false)}
              disabled={splitAwarding}
            >
              İptal
            </Button>
            <Button
              type="button"
              onClick={handleConfirmSplitAward}
              disabled={splitAwarding}
              style={{ background: "#1a7a3a", color: "#fff" }}
            >
              {splitAwarding ? "Oluşturuluyor..." : "Siparişleri Oluştur →"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

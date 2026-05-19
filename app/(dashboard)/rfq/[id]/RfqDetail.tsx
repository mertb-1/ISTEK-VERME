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
              {isOverdue && (
                <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#c0392b" }}>
                  <AlertTriangle className="w-3 h-3" /> Süresi geçti
                </span>
              )}
            </div>
            <h1 className="font-display text-4xl leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#111" }}>
              {rfq.title}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: "#7a6e67" }}>
              <span>Oluşturuldu: {new Date(rfq.created_at).toLocaleDateString("tr-TR")}</span>
              {deadline && (
                <span style={{ color: isOverdue ? "#c0392b" : "#7a6e67" }}>
                  Son tarih: {deadline.toLocaleDateString("tr-TR")}
                </span>
              )}
              <span>{items.length} kalem · {recipients.length} tedarikçi</span>
            </div>
            {rfq.notes && (
              <p className="text-sm mt-3 px-3 py-2 rounded-lg inline-block" style={{ background: "#f5f0eb", color: "#7a6e67" }}>{rfq.notes}</p>
            )}
          </div>
        </div>
      </div>

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
                    return (
                      <th key={r.id} className="text-center px-4 py-4 min-w-[180px]" style={{ borderRight: "1px solid #e6ddd4" }}>
                        <div className="flex flex-col items-center gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "#f5ede6", color: "#8b3a2a" }}>
                              {getInitials(s?.company_name ?? "?")}
                            </div>
                            <span className="font-semibold text-sm" style={{ color: "#111" }}>{s?.company_name}</span>
                            {isOverallCheapest && respondedRecipients.length > 1 && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: "#fef5e4", color: "#a06a00" }}>
                                <Trophy className="w-3 h-3" />
                                En ucuz
                              </span>
                            )}
                          </div>
                          {r.quotes?.[0]?.delivery_time && (
                            <span className="text-xs font-normal" style={{ color: "#7a6e67" }}>{r.quotes[0].delivery_time}</span>
                          )}
                          {r.quotes?.[0]?.payment_terms && (
                            <span className="text-xs font-normal" style={{ color: "#7a6e67" }}>{r.quotes[0].payment_terms}</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  {pendingRecipients.map((r) => {
                    const s = getSupplier(r);
                    return (
                      <th key={r.id} className="text-center px-4 py-4 min-w-[160px] opacity-40" style={{ borderRight: "1px solid #e6ddd4" }}>
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "#f5f0eb", color: "#b0a49e" }}>
                            {getInitials(s?.company_name ?? "?")}
                          </div>
                          <span className="font-medium text-sm" style={{ color: "#7a6e67" }}>{s?.company_name}</span>
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
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

                        return (
                          <td
                            key={r.id}
                            className="px-4 py-4 text-center"
                            style={{
                              borderRight: "1px solid #f0e8e0",
                              background: isCheapest ? "#edf8f1" : "transparent",
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
                    return (
                      <td key={r.id} className="px-4 py-4 text-center" style={{ borderRight: "1px solid #f0e8e0", background: isOverallCheapest ? "#edf8f1" : "transparent" }}>
                        <div className="text-xl font-bold tabular-nums" style={{ color: isOverallCheapest ? "#1a7a3a" : "#111" }}>
                          {formatPrice(total)}
                        </div>
                        {isOverallCheapest && (
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

                {cheapestMixTotal > 0 && (
                  <tr style={{ background: "#edf8f1", borderTop: "1px solid #c3e6cb" }}>
                    <td className="px-5 py-4 sticky left-0 z-10" style={{ background: "#edf8f1", borderRight: "1px solid #c3e6cb" }}>
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4" style={{ color: "#1a7a3a" }} />
                        <div>
                          <div className="font-bold text-sm uppercase tracking-wider" style={{ color: "#1a7a3a" }}>En Ucuz Karma</div>
                          <div className="text-xs mt-0.5 font-normal" style={{ color: "#1a7a3a", opacity: 0.7 }}>Her üründen en düşük</div>
                        </div>
                      </div>
                    </td>
                    <td colSpan={respondedRecipients.length + pendingRecipients.length} className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold tabular-nums" style={{ color: "#1a7a3a" }}>{formatPrice(cheapestMixTotal)}</span>
                        <span className="text-sm" style={{ color: "#1a7a3a", opacity: 0.8 }}>
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

          {/* Select supplier row */}
          <div className="px-6 py-4" style={{ borderTop: "1px solid #e6ddd4", background: "#fff" }}>
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              <span className="text-sm font-medium flex-shrink-0" style={{ color: "#7a6e67" }}>Tedarikçi seç:</span>
              {respondedRecipients.map((r) => {
                const s = getSupplier(r);
                const isOverallCheapest = cheapestSupplierRecipient?.id === r.id && respondedRecipients.length > 1;
                return (
                  <button
                    key={r.id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex-shrink-0"
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
    </div>
  );
}

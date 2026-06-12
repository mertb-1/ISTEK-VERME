"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileSpreadsheet,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  CheckCircle2,
  Check,
  Info,
  ArrowRight,
  ArrowLeftRight,
  X,
} from "lucide-react";
import { normalizeForMatch } from "@/lib/rfq-parse/keywords";
import {
  applyQuoteFieldMap,
  type QuoteParsedField,
  type QuoteParsedRow,
  type QuoteColumnSuggestion,
  type QuoteFieldMap,
} from "@/lib/rfq-parse/quote-import";
import type { RfqMeta } from "@/lib/rfq-parse/types";
import { formatMoney } from "@/lib/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

type RfqItem = {
  id: string;
  order_no: number;
  product_name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  impa_code: string | null;
};

type Supplier = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
  hasQuote: boolean;
};

type ParseApiResponse = {
  meta: RfqMeta;
  headerRowIdx: number;
  headerConfidence: "high" | "low";
  allRawRows: string[][];
  columnSuggestions: QuoteColumnSuggestion[];
  priceColumnDetected: boolean;
  previewRows: QuoteParsedRow[];
  skippedRows: number;
  sourceFileUrl: string | null;
  warnings: string[];
};

type MatchMethod = "impa" | "name" | "row" | "manual";
type Match = { rowIdx: number; method: MatchMethod };
type MatchMap = Record<string, Match | null>; // rfq_item_id → eşleşen dosya satırı

type Step = 1 | 2 | 3 | 4;

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<QuoteParsedField | "ignore", string> = {
  product_name: "Ürün Adı",
  impa_code: "IMPA Kodu",
  offered_brand: "Teklif Edilen Marka",
  quantity: "Miktar",
  unit_price: "Birim Fiyat",
  total_price: "Toplam Fiyat",
  notes: "Not",
  ignore: "Bu sütunu kullanma",
};

const ASSIGNABLE_FIELDS: (QuoteParsedField | "ignore")[] = [
  "product_name", "impa_code", "offered_brand", "quantity",
  "unit_price", "total_price", "notes", "ignore",
];

const STEP_LABELS = ["Tedarikçi & Dosya", "Sütunlar", "Eşleştirme", "Özet"];

const METHOD_BADGES: Record<MatchMethod, { label: string; bg: string; color: string }> = {
  impa: { label: "IMPA eşleşmesi", bg: "#edf8f1", color: "#1a7a3a" },
  name: { label: "Ad eşleşmesi", bg: "#edf8f1", color: "#1a7a3a" },
  row: { label: "Satır sırası", bg: "#fef5e4", color: "#a06a00" },
  manual: { label: "Manuel", bg: "#f5f0eb", color: "#7a6e67" },
};

// ─── Matching ─────────────────────────────────────────────────────────────────

// Öncelik: 1) IMPA kodu  2) normalize edilmiş ürün adı  3) satır sırası.
// Her dosya satırı en fazla bir RFQ kalemiyle eşleşir.
function autoMatch(items: RfqItem[], rows: QuoteParsedRow[]): MatchMap {
  const result: MatchMap = {};
  const used = new Set<number>();

  for (const item of items) {
    if (!item.impa_code?.trim()) continue;
    const norm = normalizeForMatch(item.impa_code);
    const idx = rows.findIndex(
      (r, i) => !used.has(i) && r.impa_code && normalizeForMatch(r.impa_code) === norm
    );
    if (idx >= 0) { result[item.id] = { rowIdx: idx, method: "impa" }; used.add(idx); }
  }

  for (const item of items) {
    if (result[item.id]) continue;
    const norm = normalizeForMatch(item.product_name);
    if (!norm) continue;
    const idx = rows.findIndex(
      (r, i) => !used.has(i) && r.product_name && normalizeForMatch(r.product_name) === norm
    );
    if (idx >= 0) { result[item.id] = { rowIdx: idx, method: "name" }; used.add(idx); }
  }

  items.forEach((item, i) => {
    if (result[item.id]) return;
    if (i < rows.length && !used.has(i)) {
      result[item.id] = { rowIdx: i, method: "row" };
      used.add(i);
    } else {
      result[item.id] = null;
    }
  });

  return result;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center mb-10">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as Step;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <div className="flex-1 h-px mx-3" style={{ background: done ? "#8b3a2a" : "#e6ddd4" }} />
            )}
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                style={
                  done
                    ? { background: "#8b3a2a", color: "#fff" }
                    : active
                    ? { background: "#111", color: "#fff", boxShadow: "0 0 0 4px #f0e9e2" }
                    : { background: "#f5f0eb", color: "#b0a49e" }
                }
              >
                {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className="text-xs mt-1.5 font-medium whitespace-nowrap"
                style={active ? { color: "#111" } : done ? { color: "#8b3a2a" } : { color: "#b0a49e" }}
              >
                {label}
              </span>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export default function ImportQuoteWizard({
  rfq,
  items,
  suppliers,
}: {
  rfq: { id: string; title: string; currency: string };
  items: RfqItem[];
  suppliers: Supplier[];
}) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseResp, setParseResp] = useState<ParseApiResponse | null>(null);
  const [fieldMap, setFieldMap] = useState<QuoteFieldMap>({});

  const [rows, setRows] = useState<QuoteParsedRow[]>([]);
  const [skippedRows, setSkippedRows] = useState(0);
  const [matches, setMatches] = useState<MatchMap>({});

  const [deliveryTime, setDeliveryTime] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [payloadPreview, setPayloadPreview] = useState("");

  const fmt = (n: number | null | undefined) => formatMoney(n, rfq.currency);
  const selectedSupplier = suppliers.find((s) => s.id === supplierId) ?? null;

  // ── Step 1: dosya yükleme ───────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setLoading(true);
    setFileName(file.name);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/quote/parse-file", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Dosya işlenemedi.");
        setLoading(false);
        return;
      }

      const resp = json as ParseApiResponse;
      setParseResp(resp);
      const map: QuoteFieldMap = {};
      for (const s of resp.columnSuggestions) map[s.colIndex] = s.suggestedField;
      setFieldMap(map);
      setStep(2);
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      if (!supplierId) {
        setError("Önce tedarikçi seçin.");
        return;
      }
      handleFile(file);
    },
    [handleFile, supplierId]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (files) => {
      const code = files[0]?.errors[0]?.code;
      if (code === "file-too-large") setError("Dosya 10 MB'den büyük olamaz.");
      else if (code === "file-invalid-type") setError("Sadece .xlsx, .xls ve .csv formatları kabul edilir.");
      else setError("Geçersiz dosya.");
    },
  });

  // ── Step 2 → 3: sütun map'ini uygula + otomatik eşleştir ──────────────────

  const goToMatching = () => {
    if (!parseResp) return;
    const hasPrice = Object.values(fieldMap).some((f) => f === "unit_price" || f === "total_price");
    if (!hasPrice) {
      setError("En az bir fiyat sütunu (Birim Fiyat veya Toplam Fiyat) eşleştirin.");
      return;
    }
    setError("");
    const { rows: parsed, skippedRows: skipped } = applyQuoteFieldMap(
      parseResp.allRawRows,
      parseResp.headerRowIdx,
      fieldMap
    );
    if (parsed.length === 0) {
      setError("Dosyadan kalem çıkarılamadı. Sütun eşleştirmesini kontrol edin.");
      return;
    }
    setRows(parsed);
    setSkippedRows(skipped);
    setMatches(autoMatch(items, parsed));
    setStep(3);
  };

  // ── Step 3: eşleştirme istatistikleri ───────────────────────────────────────

  const usedRowIdxs = useMemo(() => {
    const s = new Set<number>();
    for (const m of Object.values(matches)) if (m) s.add(m.rowIdx);
    return s;
  }, [matches]);

  // Satır fiyatı: birim fiyat yoksa toplam ÷ miktar'dan türetilir
  const rowUnitPrice = useCallback(
    (row: QuoteParsedRow, item: RfqItem): number | null => {
      if (row.unit_price != null) return row.unit_price;
      const qty = row.quantity ?? item.quantity;
      if (row.total_price != null && qty > 0) {
        return Math.round((row.total_price / qty) * 10000) / 10000;
      }
      return null;
    },
    []
  );

  const matchedItems = useMemo(
    () =>
      items
        .map((item) => {
          const m = matches[item.id];
          return m ? { item, row: rows[m.rowIdx], method: m.method } : null;
        })
        .filter((x): x is { item: RfqItem; row: QuoteParsedRow; method: MatchMethod } => x !== null),
    [items, matches, rows]
  );

  const matchedWithPrice = useMemo(
    () => matchedItems.filter(({ item, row }) => rowUnitPrice(row, item) != null),
    [matchedItems, rowUnitPrice]
  );

  const unmatchedItemCount = items.length - matchedItems.length;
  const priceMissingCount = matchedItems.length - matchedWithPrice.length;
  const unmatchedRows = rows.filter((_, i) => !usedRowIdxs.has(i));

  const computedTotal = matchedWithPrice.reduce(
    (sum, { item, row }) => sum + (rowUnitPrice(row, item) ?? 0) * item.quantity,
    0
  );
  const fileTotal = matchedItems.reduce(
    (sum, { row }) => sum + (row.total_price ?? 0),
    0
  );

  const setManualMatch = (itemId: string, rowIdxStr: string) => {
    setMatches((prev) => {
      const next: MatchMap = { ...prev };
      if (rowIdxStr === "") {
        next[itemId] = null;
        return next;
      }
      const rowIdx = parseInt(rowIdxStr);
      // Satır başka kaleme atanmışsa oradan kaldır — bir satır tek kalemle eşleşir
      for (const [otherId, m] of Object.entries(next)) {
        if (otherId !== itemId && m?.rowIdx === rowIdx) next[otherId] = null;
      }
      next[itemId] = { rowIdx, method: "manual" };
      return next;
    });
  };

  // ── Step 4: payload (Phase 3 — DB'ye YAZILMAZ) ─────────────────────────────

  const buildPayload = () => ({
    rfq_id: rfq.id,
    supplier_id: supplierId,
    source_file_url: parseResp?.sourceFileUrl ?? null,
    delivery_time: deliveryTime.trim() || null,
    payment_terms: paymentTerms.trim() || null,
    supplier_notes: supplierNotes.trim() || null,
    items: matchedWithPrice.map(({ item, row }) => {
      const unitPrice = rowUnitPrice(row, item)!;
      return {
        rfq_item_id: item.id,
        unit_price: unitPrice,
        total_price: row.total_price ?? Math.round(unitPrice * item.quantity * 100) / 100,
        offered_brand: row.offered_brand || null,
        notes: row.notes || null,
      };
    }),
    import_raw: {
      file_name: fileName,
      header_row_idx: parseResp?.headerRowIdx ?? 0,
      field_map: fieldMap,
      skipped_rows: skippedRows,
      matches: matchedItems.map(({ item, row, method }) => ({
        rfq_item_id: item.id,
        source_row: row.source_row,
        method,
      })),
    },
  });

  const handleImport = () => {
    const payload = buildPayload();
    // Phase 3: kayıt yok — payload yalnızca önizlenir ve console'a yazılır
    console.log("[quote-import] payload:", payload);
    setPayloadPreview(JSON.stringify(payload, null, 2));
  };

  const reset = () => {
    setStep(1);
    setParseResp(null);
    setFieldMap({});
    setRows([]);
    setMatches({});
    setFileName("");
    setError("");
    setPayloadPreview("");
  };

  const currentHeaders = parseResp?.allRawRows[parseResp.headerRowIdx] ?? [];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: "#b0a49e" }}>
          <Link href="/rfq" className="hover:underline" style={{ color: "#7a6e67" }}>Tekliflerim</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href={`/rfq/${rfq.id}`} className="hover:underline max-w-[200px] truncate" style={{ color: "#7a6e67" }}>
            {rfq.title}
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span>Teklif İçe Aktar</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#111", fontFamily: "'Playfair Display', Georgia, serif" }}>
          Teklif İçe Aktar
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#7a6e67" }}>
          Mail ile aldığınız tedarikçi teklifini yükleyin; fiyatlar karşılaştırma tablosuna eklenir.
        </p>
      </div>

      <Stepper current={step} />

      {/* ═══════════════════ STEP 1: TEDARİKÇİ + DOSYA ═══════════════════════ */}
      {step === 1 && (
        <div className="space-y-5">
          <Card title="Tedarikçi">
            <p className="text-xs mb-3" style={{ color: "#7a6e67" }}>
              Bu teklif dosyası hangi tedarikçiden geldi?
            </p>
            <select
              value={supplierId}
              onChange={(e) => { setSupplierId(e.target.value); setError(""); }}
              className="w-full text-sm rounded-lg px-3 py-2.5 focus:outline-none cursor-pointer"
              style={
                supplierId
                  ? { border: "1.5px solid #8b3a2a", background: "#fff", color: "#111" }
                  : { border: "1.5px solid #e6ddd4", background: "#fff", color: "#b0a49e" }
              }
              onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
              onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
              <option value="">— Tedarikçi seçin —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id} disabled={s.hasQuote}>
                  {s.company_name}
                  {s.hasQuote ? " — bu talepte teklifi var" : ""}
                </option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <p className="text-xs mt-2" style={{ color: "#a06a00" }}>
                Kayıtlı tedarikçiniz yok.{" "}
                <Link href="/suppliers" className="font-semibold hover:underline" style={{ color: "#8b3a2a" }}>
                  Önce tedarikçi ekleyin.
                </Link>
              </p>
            )}
          </Card>

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className="rounded-2xl text-center transition-all"
            style={{
              cursor: supplierId ? "pointer" : "not-allowed",
              opacity: supplierId ? 1 : 0.55,
              ...(isDragActive
                ? { border: "2px dashed #8b3a2a", background: "#fdf5f0", padding: "3.5rem 2rem" }
                : { border: "2px dashed #d4c5b8", background: "#faf4ee", padding: "3.5rem 2rem" }),
            }}
          >
            <input {...getInputProps()} disabled={!supplierId} />

            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#e6ddd4", borderTopColor: "#8b3a2a" }}
                />
                <p className="text-sm font-medium" style={{ color: "#7a6e67" }}>Dosya işleniyor...</p>
              </div>
            ) : isDragActive ? (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10" style={{ color: "#8b3a2a" }} />
                <p className="text-base font-semibold" style={{ color: "#8b3a2a" }}>Dosyayı bırakın</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#f5f0eb" }}>
                  <FileSpreadsheet className="w-7 h-7" style={{ color: "#8b3a2a" }} />
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "#111" }}>
                    Teklif dosyasını buraya sürükleyin
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: "#7a6e67" }}>
                    {supplierId ? "ya da tıklayarak seçin" : "önce tedarikçi seçin"}
                  </p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: "#f0e9e2", color: "#b0a49e" }}>
                  .xlsx, .xls ve .csv — maks. 10 MB
                </span>
              </div>
            )}
          </div>

          {error && <ErrorBox message={error} />}
        </div>
      )}

      {/* ═══════════════════ STEP 2: SÜTUN EŞLEŞTİRME ════════════════════════ */}
      {step === 2 && parseResp && (
        <div className="space-y-5">
          {parseResp.warnings.length > 0 && (
            <div className="space-y-2">
              {parseResp.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 text-sm px-4 py-3 rounded-xl"
                  style={{ background: "#fef5e4", color: "#a06a00", border: "1px solid #f3d87c" }}
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          <Card
            title="Sütun Eşleştirme"
            badge={
              parseResp.priceColumnDetected
                ? { text: "Fiyat sütunu bulundu", color: "green" }
                : { text: "Fiyat sütununu elle seçin", color: "amber" }
            }
          >
            <p className="text-xs mb-5" style={{ color: "#7a6e67" }}>
              Her sütunun hangi bilgiyi içerdiğini seçin. En az bir fiyat sütunu gereklidir.
            </p>

            <div className="space-y-1">
              {currentHeaders.map((header, ci) => {
                if (!header.trim()) return null;
                const raw = fieldMap[ci];
                const current: QuoteParsedField | "ignore" | null = raw === undefined ? null : raw;
                if (current === "ignore") return null;
                const isMapped = !!current;
                const isPrice = current === "unit_price" || current === "total_price";

                return (
                  <div
                    key={ci}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                    style={isMapped ? { background: "#faf4ee" } : {}}
                  >
                    <span className="w-5 text-xs text-center tabular-nums flex-shrink-0" style={{ color: "#b0a49e" }}>
                      {ci + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate" style={{ color: "#111" }}>
                      {header}
                    </span>
                    {isPrice && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "#edf8f1", color: "#1a7a3a" }}>
                        fiyat
                      </span>
                    )}
                    <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#d4c5b8" }} />
                    <select
                      value={current ?? ""}
                      onChange={(e) => {
                        const val = e.target.value as QuoteParsedField | "ignore" | "";
                        setFieldMap((prev) => ({ ...prev, [ci]: val === "" ? null : val }));
                      }}
                      className="text-sm rounded-lg px-3 py-1.5 focus:outline-none min-w-[180px] cursor-pointer"
                      style={
                        isMapped
                          ? { border: "1.5px solid #8b3a2a", background: "#fff", color: "#8b3a2a" }
                          : { border: "1.5px solid #e6ddd4", background: "#fff", color: "#b0a49e" }
                      }
                      onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                      onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                    >
                      <option value="">— Eşleştirilmedi —</option>
                      {ASSIGNABLE_FIELDS.map((f) => (
                        <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </Card>

          {error && <ErrorBox message={error} />}

          <NavButtons onBack={reset} backLabel="Yeni Dosya" onNext={goToMatching} nextLabel="Kalemleri Eşleştir" />
        </div>
      )}

      {/* ═══════════════════ STEP 3: KALEM EŞLEŞTİRME ════════════════════════ */}
      {step === 3 && (
        <div className="space-y-5">
          {/* Sayaçlar */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-xl"
              style={{ background: "#edf8f1", color: "#1a7a3a" }}
            >
              <CheckCircle2 className="w-4 h-4" />
              {matchedWithPrice.length} kalem eşleşti
            </span>
            {priceMissingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "#fef5e4", color: "#a06a00" }}>
                <AlertCircle className="w-3 h-3" />
                {priceMissingCount} eşleşmede fiyat yok
              </span>
            )}
            {unmatchedItemCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "#fdf0ee", color: "#8b3a2a" }}>
                <AlertCircle className="w-3 h-3" />
                {unmatchedItemCount} RFQ kalemi eşleşmedi
              </span>
            )}
            {unmatchedRows.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                {unmatchedRows.length} dosya satırı kullanılmadı
              </span>
            )}
          </div>

          {/* Eşleştirme tablosu */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e6ddd4", background: "#fff" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold w-8" style={{ color: "#b0a49e" }}>#</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold" style={{ color: "#7a6e67" }}>RFQ Kalemi</th>
                    <th className="w-10" />
                    <th className="text-left px-3 py-3 text-xs font-semibold" style={{ color: "#7a6e67" }}>Dosyadaki Ürün</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold" style={{ color: "#7a6e67" }}>Güven</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold" style={{ color: "#7a6e67" }}>Birim Fiyat</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const m = matches[item.id];
                    const row = m ? rows[m.rowIdx] : null;
                    const unitPrice = row ? rowUnitPrice(row, item) : null;
                    const unmatched = !m;
                    const noPrice = !!m && unitPrice == null;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: "1px solid #f0e9e2",
                          background: unmatched ? "#fdf0ee" : noPrice ? "#fef5e4" : undefined,
                        }}
                      >
                        <td className="px-4 py-3 text-xs tabular-nums align-top" style={{ color: "#b0a49e" }}>
                          {idx + 1}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="font-medium" style={{ color: "#111" }}>{item.product_name}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>
                            {item.quantity} {item.unit}
                            {item.impa_code && (
                              <span className="ml-2 px-1.5 py-0.5 rounded" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                                IMPA {item.impa_code}
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="px-1 py-3 align-top">
                          <ArrowLeftRight className="w-3.5 h-3.5 mt-1.5" style={{ color: unmatched ? "#e8a090" : "#d4c5b8" }} />
                        </td>
                        <td className="px-3 py-3 align-top">
                          <select
                            value={m ? String(m.rowIdx) : ""}
                            onChange={(e) => setManualMatch(item.id, e.target.value)}
                            className="text-sm rounded-lg px-2.5 py-1.5 focus:outline-none w-full max-w-[320px] cursor-pointer"
                            style={
                              m
                                ? { border: "1.5px solid #d4c5b8", background: "#fff", color: "#111" }
                                : { border: "1.5px solid #e8a090", background: "#fff", color: "#8b3a2a" }
                            }
                            onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                            onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                          >
                            <option value="">— Eşleşme yok —</option>
                            {rows.map((r, ri) => (
                              <option key={ri} value={ri}>
                                Satır {r.source_row}: {(r.product_name || r.impa_code).slice(0, 60)}
                              </option>
                            ))}
                          </select>
                          {row?.offered_brand && (
                            <p className="text-xs mt-1" style={{ color: "#7a6e67" }}>Marka: {row.offered_brand}</p>
                          )}
                          {noPrice && (
                            <p className="text-xs mt-1 font-medium" style={{ color: "#a06a00" }}>
                              Bu satırda fiyat yok — kaleme dahil edilmez
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          {m && (
                            <span
                              className="inline-flex text-xs px-2.5 py-1 rounded-full whitespace-nowrap"
                              style={{ background: METHOD_BADGES[m.method].bg, color: METHOD_BADGES[m.method].color }}
                            >
                              {METHOD_BADGES[m.method].label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right align-top tabular-nums font-medium" style={{ color: unitPrice != null ? "#111" : "#b0a49e" }}>
                          {unitPrice != null ? fmt(unitPrice) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kullanılmayan dosya satırları */}
          {unmatchedRows.length > 0 && (
            <Card title="Kullanılmayan Dosya Satırları" badge={{ text: `${unmatchedRows.length} satır`, color: "amber" }}>
              <p className="text-xs mb-3" style={{ color: "#7a6e67" }}>
                Bu satırlar hiçbir RFQ kalemiyle eşleşmedi ve içe aktarılmayacak.
              </p>
              <div className="space-y-1.5">
                {unmatchedRows.map((r) => (
                  <div
                    key={r.source_row}
                    className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg"
                    style={{ background: "#faf4ee" }}
                  >
                    <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "#b0a49e" }}>
                      Satır {r.source_row}
                    </span>
                    <span className="flex-1 truncate" style={{ color: "#7a6e67" }}>
                      {r.product_name || r.impa_code}
                    </span>
                    {r.unit_price != null && (
                      <span className="tabular-nums text-xs flex-shrink-0" style={{ color: "#7a6e67" }}>
                        {fmt(r.unit_price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {error && <ErrorBox message={error} />}

          <NavButtons
            onBack={() => setStep(2)}
            onNext={() => {
              if (matchedWithPrice.length === 0) {
                setError("İçe aktarılacak fiyatlı kalem yok. Eşleştirmeleri kontrol edin.");
                return;
              }
              setError("");
              setStep(4);
            }}
            nextLabel="Özete Geç"
          />
        </div>
      )}

      {/* ═══════════════════ STEP 4: ÖZET ════════════════════════════════════ */}
      {step === 4 && selectedSupplier && (
        <div className="space-y-5">
          <Card title="İçe Aktarma Özeti">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: "#f5ede6", color: "#8b3a2a" }}
              >
                {selectedSupplier.company_name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#111" }}>
                  {selectedSupplier.company_name}
                </p>
                <p className="text-xs truncate" style={{ color: "#7a6e67" }}>{selectedSupplier.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <SummaryStat label="Dosya" value={fileName} />
              <SummaryStat label="Eşleşen kalem" value={`${matchedWithPrice.length} / ${items.length}`} />
              <SummaryStat label="Dosya satırı" value={`${rows.length}`} />
              <SummaryStat label="Hesaplanan toplam" value={fmt(computedTotal)} strong />
            </div>

            {fileTotal > 0 && Math.abs(fileTotal - computedTotal) > 0.01 && (
              <div
                className="flex items-start gap-2.5 text-sm px-4 py-3 rounded-xl mb-5"
                style={{ background: "#fef5e4", color: "#a06a00", border: "1px solid #f3d87c" }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Dosyadaki toplam ({fmt(fileTotal)}) ile hesaplanan toplam ({fmt(computedTotal)}) farklı.
                Hesaplanan toplam birim fiyat × RFQ miktarı üzerinden alınır.
              </div>
            )}

            {(unmatchedItemCount > 0 || unmatchedRows.length > 0 || priceMissingCount > 0) && (
              <div className="flex items-center gap-2 flex-wrap mb-5">
                {unmatchedItemCount > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#fdf0ee", color: "#8b3a2a" }}>
                    {unmatchedItemCount} RFQ kalemi fiyatsız kalacak
                  </span>
                )}
                {priceMissingCount > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#fef5e4", color: "#a06a00" }}>
                    {priceMissingCount} eşleşme fiyatsız — dahil edilmeyecek
                  </span>
                )}
                {unmatchedRows.length > 0 && (
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                    {unmatchedRows.length} dosya satırı kullanılmadı
                  </span>
                )}
              </div>
            )}

            {/* Opsiyonel teklif bilgileri */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                  Teslim Süresi <span style={{ color: "#b0a49e" }}>(opsiyonel)</span>
                </label>
                <input
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  placeholder="örn. 5 iş günü"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                  Ödeme Koşulları <span style={{ color: "#b0a49e" }}>(opsiyonel)</span>
                </label>
                <input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="örn. 30 gün vade"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                  Tedarikçi Notu <span style={{ color: "#b0a49e" }}>(opsiyonel)</span>
                </label>
                <textarea
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  rows={2}
                  placeholder="Tedarikçinin mailindeki ek notlar"
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                  style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>
            </div>
          </Card>

          {/* Phase 3: kayıt yapılmaz */}
          {payloadPreview ? (
            <Card title="Payload Önizleme" badge={{ text: "Veritabanına yazılmadı", color: "amber" }}>
              <div
                className="flex items-start gap-2.5 text-sm px-4 py-3 rounded-xl mb-4"
                style={{ background: "#faf4ee", color: "#7a6e67", border: "1px solid #e6ddd4" }}
              >
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#b0a49e" }} />
                Önizleme aşaması: bu payload console&apos;a yazıldı, kayıt bir sonraki fazda yapılacak.
              </div>
              <pre
                className="text-xs p-4 rounded-xl overflow-x-auto max-h-[400px] overflow-y-auto"
                style={{ background: "#faf4ee", color: "#111", border: "1px solid #e6ddd4" }}
              >
                {payloadPreview}
              </pre>
              <button
                onClick={() => setPayloadPreview("")}
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg"
                style={{ color: "#7a6e67", background: "#f5f0eb" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#ede5dd")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f0eb")}
              >
                <X className="w-3.5 h-3.5" />
                Önizlemeyi kapat
              </button>
            </Card>
          ) : null}

          {error && <ErrorBox message={error} />}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ border: "1px solid #e6ddd4", color: "#7a6e67" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#faf4ee")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ChevronLeft className="w-4 h-4" />
              Geri
            </button>
            <button
              onClick={handleImport}
              disabled={matchedWithPrice.length === 0}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: "#111" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#111")}
            >
              Teklifi İçe Aktar
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SummaryStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="px-3.5 py-3 rounded-xl" style={{ background: "#faf4ee" }}>
      <p className="text-xs" style={{ color: "#b0a49e" }}>{label}</p>
      <p
        className={`text-sm mt-0.5 truncate ${strong ? "font-bold" : "font-medium"}`}
        style={{ color: strong ? "#1a7a3a" : "#111" }}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      className="flex items-center gap-2.5 text-sm px-4 py-3.5 rounded-xl"
      style={{ background: "#fdf0ee", color: "#8b3a2a", border: "1px solid #f0cec6" }}
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  );
}

function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: { text: string; color: "green" | "amber" };
  children: React.ReactNode;
}) {
  const badgeStyle =
    badge?.color === "green"
      ? { background: "#edf8f1", color: "#1a7a3a" }
      : { background: "#fef5e4", color: "#a06a00" };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e6ddd4", background: "#fff" }}>
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}
      >
        <span className="text-sm font-semibold" style={{ color: "#111" }}>{title}</span>
        {badge && (
          <span className="text-xs font-medium px-2.5 py-0.5 rounded-full" style={badgeStyle}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function NavButtons({
  onBack,
  backLabel = "Geri",
  onNext,
  nextLabel,
}: {
  onBack: () => void;
  backLabel?: string;
  onNext: () => void;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center justify-between pt-1">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        style={{ border: "1px solid #e6ddd4", color: "#7a6e67" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#faf4ee")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <ChevronLeft className="w-4 h-4" />
        {backLabel}
      </button>
      <button
        onClick={onNext}
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
        style={{ background: "#111" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#111")}
      >
        {nextLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

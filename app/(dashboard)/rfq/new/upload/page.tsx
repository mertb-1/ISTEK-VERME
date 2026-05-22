"use client";

import { Fragment, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileSpreadsheet,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  Check,
  Info,
  ChevronLeft,
  ArrowRight,
} from "lucide-react";
import type {
  ParsedItem,
  ParsedItemField,
  ExcelApiResponse,
  ColumnSuggestion,
} from "@/lib/rfq-parse/types";
import { suggestColumns, applyFieldMap, normalizeForMatch, HIDDEN_COLUMN_KEYWORDS } from "@/lib/rfq-parse/keywords";

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<ParsedItemField | "price" | "ignore", string> = {
  product_name: "Ürün Adı",
  brand: "Marka",
  quantity: "Miktar",
  unit: "Birim",
  impa_code: "IMPA Kodu",
  description: "Açıklama",
  price: "Fiyat (Atla)",
  ignore: "Bu sütunu kullanma",
};

const ASSIGNABLE_FIELDS: (ParsedItemField | "price" | "ignore")[] = [
  "product_name", "brand", "quantity", "unit", "impa_code", "description", "price", "ignore",
];

const STEP_LABELS = ["Yükle", "Sütunlar", "Ürünler"];
const STEP_NUMS: Step[] = [1, 3, 4];

type Step = 1 | 2 | 3 | 4;
type FieldMap = Record<number, ParsedItemField | "price" | "ignore" | null>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFieldMap(suggestions: ColumnSuggestion[]): FieldMap {
  const map: FieldMap = {};
  for (const s of suggestions) map[s.colIndex] = s.suggestedField;
  return map;
}

function emptyItem(): ParsedItem {
  return { product_name: "", brand: "", quantity: "", unit: "", impa_code: "", description: "" };
}

function extractListType(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ");
  const keywords = ["kabin", "kumanya", "yedek parca", "malzeme", "liste", "istek"];
  const lower = base.toLowerCase();
  for (const kw of keywords) {
    if (lower.includes(kw)) return kw.charAt(0).toUpperCase() + kw.slice(1);
  }
  return "";
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center mb-10">
      {STEP_LABELS.map((label, i) => {
        const stepNum = STEP_NUMS[i];
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <div
                className="flex-1 h-px mx-3"
                style={{ background: done ? "#8b3a2a" : "#e6ddd4" }}
              />
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
                style={
                  active
                    ? { color: "#111" }
                    : done
                    ? { color: "#8b3a2a" }
                    : { color: "#b0a49e" }
                }
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [apiResp, setApiResp] = useState<ExcelApiResponse | null>(null);
  const [fileName, setFileName] = useState("");
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [fieldMap, setFieldMap] = useState<FieldMap>({});
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [skippedRows, setSkippedRows] = useState(0);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleExcelFile = useCallback(async (file: File) => {
    setError("");
    setLoading(true);
    setFileName(file.name);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/rfq/parse-file", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Dosya işlenemedi.");
        setLoading(false);
        return;
      }

      const resp = json as ExcelApiResponse;
      setApiResp(resp);
      setHeaderRowIdx(resp.headerRowIdx);
      setFieldMap(buildFieldMap(resp.columnSuggestions));
      setStep(3);
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
      handleExcelFile(file);
    },
    [handleExcelFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (files) => {
      const code = files[0]?.errors[0]?.code;
      if (code === "file-too-large") setError("Dosya 10 MB'den büyük olamaz.");
      else if (code === "file-invalid-type") setError("Sadece .xlsx ve .xls formatları kabul edilir.");
      else setError("Geçersiz dosya.");
    },
  });

  // ── Step 2 → 3 ────────────────────────────────────────────────────────────

  const goToStep3Excel = () => {
    if (!apiResp) return;
    const newHeaders = apiResp.allRawRows[headerRowIdx] ?? [];
    const { suggestions } = suggestColumns(newHeaders);
    setFieldMap(buildFieldMap(suggestions));
    setStep(3);
  };

  // ── Step 3 → 4 ────────────────────────────────────────────────────────────

  const goToStep4Excel = () => {
    if (!apiResp) return;
    const { items: parsed, skippedRows: skipped } = applyFieldMap(
      apiResp.allRawRows,
      headerRowIdx,
      fieldMap
    );
    setItems(parsed.length > 0 ? parsed : [emptyItem()]);
    setSkippedRows(skipped);
    setStep(4);
  };

  // ── Step 4: editing ────────────────────────────────────────────────────────

  const updateItem = (idx: number, field: ParsedItemField, value: string) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  // ── Confirm ───────────────────────────────────────────────────────────────

  const handleConfirm = () => {
    const valid = items.filter((i) => i.product_name.trim());
    if (valid.length === 0) { setError("En az bir geçerli ürün olmalı."); return; }

    const listType = extractListType(fileName);
    localStorage.setItem(
      "rfq_upload_items",
      JSON.stringify({
        items: valid,
        meta: {},
        listType,
        sourceFileUrl: apiResp?.sourceFileUrl ?? null,
        sourceType: "excel",
      })
    );
    router.push("/rfq/new?source=upload");
  };

  const reset = () => {
    setStep(1);
    setApiResp(null);
    setItems([]);
    setError("");
    setFieldMap({});
    setFileName("");
  };

  const currentHeaders = apiResp?.allRawRows[headerRowIdx] ?? [];
  const filledCount = items.filter((i) => i.product_name.trim()).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: "#b0a49e" }}>
          <a href="/rfq" className="hover:underline" style={{ color: "#7a6e67" }}>Tekliflerim</a>
          <ChevronRight className="w-3 h-3" />
          <a href="/rfq/new" className="hover:underline" style={{ color: "#7a6e67" }}>Yeni Teklif</a>
          <ChevronRight className="w-3 h-3" />
          <span>Dosyadan Yükle</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#111" }}>
          Dosyadan Ürün Yükle
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#7a6e67" }}>
          Excel dosyasındaki ürünler otomatik çıkarsınır, düzenleyip gönderebilirsiniz.
        </p>
      </div>

      <Stepper current={step} />

      {/* ═══════════════════════ STEP 1: DROPZONE ═══════════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className="rounded-2xl text-center cursor-pointer transition-all"
            style={
              isDragActive
                ? { border: "2px dashed #8b3a2a", background: "#fdf5f0", padding: "3.5rem 2rem" }
                : { border: "2px dashed #d4c5b8", background: "#faf4ee", padding: "3.5rem 2rem" }
            }
          >
            <input {...getInputProps()} />

            {loading ? (
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: "#e6ddd4", borderTopColor: "#8b3a2a" }}
                />
                <p className="text-sm font-medium" style={{ color: "#7a6e67" }}>
                  Excel işleniyor...
                </p>
              </div>
            ) : isDragActive ? (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10" style={{ color: "#8b3a2a" }} />
                <p className="text-base font-semibold" style={{ color: "#8b3a2a" }}>
                  Dosyayı bırakın
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "#f5f0eb" }}
                >
                  <FileSpreadsheet className="w-7 h-7" style={{ color: "#8b3a2a" }} />
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "#111" }}>
                    Dosyayı buraya sürükleyin
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: "#7a6e67" }}>
                    ya da tıklayarak seçin
                  </p>
                </div>
                <span
                  className="text-xs px-3 py-1 rounded-full"
                  style={{ background: "#f0e9e2", color: "#b0a49e" }}
                >
                  .xlsx ve .xls — maks. 10 MB
                </span>
              </div>
            )}
          </div>

          {/* Excel şablon kartı */}
          <div
            className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
            style={{ background: "#fff", border: "1px solid #e6ddd4" }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "#edf8f1" }}
            >
              <FileSpreadsheet className="w-4.5 h-4.5" style={{ color: "#1a7a3a" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#111" }}>
                Excel şablonu
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>
                Kumanya, IMPA destekli hazır format
              </p>
            </div>
            <a
              href="/rfq-template.xlsx"
              download
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{ background: "#f5f0eb", color: "#8b3a2a" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#ede5dd")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f0eb")}
            >
              İndir
            </a>
          </div>

          <p className="text-center text-xs" style={{ color: "#b0a49e" }}>
            Ya da{" "}
            <a href="/rfq/new" className="font-semibold hover:underline" style={{ color: "#8b3a2a" }}>
              manuel olarak ürün ekleyin
            </a>
          </p>

          {error && <ErrorBox message={error} />}
        </div>
      )}

      {/* ═══════════════════════ STEP 2: HEADER ROW ════════════════════════ */}
      {step === 2 && apiResp && (
        <div className="space-y-5">
          {apiResp.priceColumnsDetected && (
            <InfoBox>
              Excel&apos;de fiyat bilgisi tespit edildi. Bu yeni bir teklif olduğu için fiyatlar
              atlandı — tedarikçiler kendi fiyatlarını verecek.
            </InfoBox>
          )}

          <Card title="Başlık Satırı" badge={
            apiResp.headerConfidence === "high"
              ? { text: "Otomatik tespit edildi", color: "green" }
              : { text: "Lütfen kontrol edin", color: "amber" }
          }>
            <p className="text-xs mb-4" style={{ color: "#7a6e67" }}>
              Yeşil satır tespit edilen başlık. Yanlışsa doğru satırı tıklayın.
            </p>
            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e6ddd4" }}>
              <table className="text-xs w-full">
                <tbody>
                  {apiResp.allRawRows
                    .slice(0, Math.min(25, apiResp.allRawRows.length))
                    .map((row, ri) => {
                      const isHeader = ri === headerRowIdx;
                      const hasContent = row.some((c) => c.trim());
                      if (!hasContent) return null;
                      return (
                        <tr
                          key={ri}
                          onClick={() => setHeaderRowIdx(ri)}
                          className="cursor-pointer transition-colors"
                          style={
                            isHeader
                              ? { background: "#edf8f1", color: "#1a7a3a" }
                              : {}
                          }
                          onMouseEnter={(e) => {
                            if (!isHeader) (e.currentTarget as HTMLElement).style.background = "#faf4ee";
                          }}
                          onMouseLeave={(e) => {
                            if (!isHeader) (e.currentTarget as HTMLElement).style.background = "";
                          }}
                        >
                          <td className="px-3 py-2 w-8 tabular-nums select-none" style={{ color: "#b0a49e" }}>
                            {ri + 1}
                          </td>
                          {row.slice(0, 8).map((cell, ci) => (
                            <td
                              key={ci}
                              className="px-3 py-2 max-w-[130px] truncate"
                              style={isHeader ? { fontWeight: 600 } : { color: "#7a6e67" }}
                            >
                              {cell || <span style={{ color: "#e6ddd4" }}>—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>

          {apiResp.warnings.length > 0 && (
            <div className="space-y-2">
              {apiResp.warnings.map((w, i) => (
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

          <NavButtons onBack={reset} backLabel="Yeni Dosya" onNext={goToStep3Excel} nextLabel="Sütunları Ayarla" />
        </div>
      )}

      {/* ═══════════════════════ STEP 3: COLUMN MAPPING ════════════════════ */}
      {step === 3 && apiResp && (
        <div className="space-y-5">
          <Card title="Sütun Eşleştirme">
            <p className="text-xs mb-5" style={{ color: "#7a6e67" }}>
              Her sütun için hangi bilgiyi içerdiğini seçin. Fiyat veya kullanmak istemediğiniz
              sütunları &quot;Bu sütunu kullanma&quot; olarak işaretleyin.
            </p>

            <div className="space-y-1">
              {currentHeaders.map((header, ci) => {
                if (!header.trim()) return null;
                const _raw = fieldMap[ci];
                const current: ParsedItemField | "price" | "ignore" | null =
                  _raw === undefined ? null : (_raw as ParsedItemField | "price" | "ignore" | null);
                if (current === "price" || current === "ignore") return null;
                const hn = normalizeForMatch(header);
                if (HIDDEN_COLUMN_KEYWORDS.some((k) => hn === normalizeForMatch(k))) return null;

                const isMapped = !!current;

                return (
                  <div
                    key={ci}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
                    style={isMapped ? { background: "#faf4ee" } : {}}
                  >
                    <span
                      className="w-5 text-xs text-center tabular-nums flex-shrink-0"
                      style={{ color: "#b0a49e" }}
                    >
                      {ci + 1}
                    </span>
                    <span
                      className="flex-1 text-sm font-medium truncate"
                      style={{ color: "#111" }}
                    >
                      {header}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#d4c5b8" }} />
                    <select
                      value={current ?? ""}
                      onChange={(e) => {
                        const val = e.target.value as ParsedItemField | "price" | "ignore" | "";
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
                        <option key={f} value={f}>
                          {FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </Card>

          <NavButtons onBack={reset} backLabel="Yeni Dosya" onNext={goToStep4Excel} nextLabel="Ürünleri Önizle" />
        </div>
      )}

      {/* ═══════════════════════ STEP 4: PRODUCT PREVIEW ════════════════════ */}
      {step === 4 && (
        <div className="space-y-5">
          {/* Özet satırı */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-xl"
                style={{ background: "#edf8f1", color: "#1a7a3a" }}
              >
                <CheckCircle2 className="w-4 h-4" />
                {filledCount} ürün hazır
              </div>
              {skippedRows > 0 && (
                <span className="text-xs" style={{ color: "#b0a49e" }}>
                  {skippedRows} satır atlandı
                </span>
              )}
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg"
              style={{ color: "#7a6e67", background: "#f5f0eb" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#ede5dd")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f0eb")}
            >
              <X className="w-3.5 h-3.5" />
              Yeni dosya yükle
            </button>
          </div>

          {/* Ürün tablosu */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e6ddd4" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold w-8" style={{ color: "#b0a49e" }}>
                      #
                    </th>
                    {(
                      [
                        ["product_name", "Ürün Adı", true],
                        ["brand", "Marka", false],
                        ["quantity", "Miktar", false],
                        ["unit", "Birim", false],
                        ["impa_code", "IMPA", false],
                        ["description", "Not", false],
                      ] as [ParsedItemField, string, boolean][]
                    ).map(([, label, required]) => (
                      <th key={label} className="text-left px-3 py-3 text-xs font-semibold" style={{ color: "#7a6e67" }}>
                        {label}
                        {required && <span style={{ color: "#8b3a2a" }}> *</span>}
                      </th>
                    ))}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const rowError = !item.product_name.trim();
                    return (
                      <tr
                        key={idx}
                        style={
                          rowError
                            ? { background: "#fdf0ee", borderBottom: "1px solid #f0e9e2" }
                            : { borderBottom: "1px solid #f0e9e2" }
                        }
                      >
                        <td className="px-4 py-2 text-xs tabular-nums" style={{ color: "#b0a49e" }}>
                          {idx + 1}
                        </td>
                        {(
                          ["product_name", "brand", "quantity", "unit", "impa_code", "description"] as ParsedItemField[]
                        ).map((field) => (
                          <td key={field} className="px-2 py-2">
                            <input
                              value={item[field]}
                              onChange={(e) => updateItem(idx, field, e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg text-sm focus:outline-none"
                              style={
                                field === "product_name" && rowError
                                  ? { border: "1.5px solid #e8a090", background: "#fdf5f2", color: "#111" }
                                  : { border: "1px solid #e6ddd4", background: "#fff", color: "#111" }
                              }
                              placeholder={FIELD_LABELS[field]}
                              onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                              onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <button
                            onClick={() => removeItem(idx)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                            style={{ color: "#b0a49e" }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "#fdf0ee";
                              (e.currentTarget as HTMLElement).style.color = "#8b3a2a";
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = "transparent";
                              (e.currentTarget as HTMLElement).style.color = "#b0a49e";
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Satır ekle */}
            <div className="px-4 py-3" style={{ borderTop: "1px solid #f0e9e2" }}>
              <button
                onClick={addItem}
                className="inline-flex items-center gap-2 text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg"
                style={{ color: "#8b3a2a" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f0eb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <Plus className="w-4 h-4" />
                Satır Ekle
              </button>
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          {/* Navigasyon */}
          <div className="flex items-center justify-between gap-3 pt-1">
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
            <div className="flex items-center gap-3">
              <a
                href="/rfq/new"
                className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{ border: "1px solid #e6ddd4", color: "#7a6e67" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#faf4ee")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
              >
                Manuel Ekle
              </a>
              <button
                onClick={handleConfirm}
                disabled={filledCount === 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: "#111" }}
              >
                Onayla ve Devam Et
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2.5 text-sm px-4 py-3.5 rounded-xl"
      style={{ background: "#faf4ee", color: "#7a6e67", border: "1px solid #e6ddd4" }}
    >
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#b0a49e" }} />
      {children}
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

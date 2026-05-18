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
} from "lucide-react";
import type {
  ParsedItem,
  ParsedItemField,
  RfqMeta,
  ExcelApiResponse,
  ColumnSuggestion,
} from "@/lib/rfq-parse/types";
import { suggestColumns, applyFieldMap } from "@/lib/rfq-parse/keywords";

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

const STEP_LABELS = ["Yükle", "Başlık & Satır", "Sütunlar", "Ürünler"];

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
    <div className="flex items-center mb-8">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as Step;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <div className={`flex-1 h-0.5 mx-2 ${done ? "bg-blue-500" : "bg-gray-200"}`} />
            )}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  done
                    ? "bg-blue-600 text-white"
                    : active
                    ? "bg-blue-600 text-white ring-4 ring-blue-100"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span
                className={`text-xs mt-1 whitespace-nowrap ${
                  active ? "text-blue-600 font-medium" : "text-gray-400"
                }`}
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

  // API response (Excel)
  const [apiResp, setApiResp] = useState<ExcelApiResponse | null>(null);
  const [fileName, setFileName] = useState("");

  // Step 2: which header row is confirmed
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  // Meta fields
  const [metaVessel, setMetaVessel] = useState("");
  const [metaCompany, setMetaCompany] = useState("");
  const [metaDate, setMetaDate] = useState("");
  const [metaContact, setMetaContact] = useState("");

  // Step 3: column field map
  const [fieldMap, setFieldMap] = useState<FieldMap>({});

  // Step 4: editable items
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
      setMetaVessel(resp.meta.vessel ?? "");
      setMetaCompany(resp.meta.company ?? "");
      setMetaDate(resp.meta.date ?? "");
      setMetaContact(resp.meta.contact ?? "");
      setFieldMap(buildFieldMap(resp.columnSuggestions));
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
      else if (code === "file-invalid-type") setError("Sadece .xlsx ve .xls kabul edilir.");
      else setError("Geçersiz dosya.");
    },
  });

  // ── Excel Step 2 → 3 ──────────────────────────────────────────────────────

  const goToStep3Excel = () => {
    if (!apiResp) return;
    const newHeaders = apiResp.allRawRows[headerRowIdx] ?? [];
    const { suggestions } = suggestColumns(newHeaders);
    setFieldMap(buildFieldMap(suggestions));
    setStep(3);
  };

  // ── Excel Step 3 → 4 ──────────────────────────────────────────────────────

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

  // ── Confirm → localStorage → /rfq/new ─────────────────────────────────────

  const handleConfirm = () => {
    const valid = items.filter((i) => i.product_name.trim());
    if (valid.length === 0) { setError("En az bir geçerli ürün olmalı."); return; }

    const meta: RfqMeta = {
      vessel: metaVessel || undefined,
      company: metaCompany || undefined,
      date: metaDate || undefined,
      contact: metaContact || undefined,
    };

    const listType = extractListType(fileName);

    localStorage.setItem(
      "rfq_upload_items",
      JSON.stringify({
        items: valid,
        meta,
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
          <a href="/rfq" className="hover:text-gray-600 transition-colors">Tekliflerim</a>
          <ChevronRight className="w-3.5 h-3.5" />
          <a href="/rfq/new" className="hover:text-gray-600 transition-colors">Yeni Teklif</a>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-600">Dosyadan Yükle</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Dosyadan Ürün Yükle</h1>
        <p className="text-gray-500 mt-1">
          Excel (.xlsx, .xls) dosyası yükleyin, ürünler otomatik çıkarsın.
        </p>
      </div>

      <Stepper current={step} />

      {/* ═══════════════════════ STEP 1: DROPZONE ═══════════════════════════ */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex justify-center mb-4">
              {isDragActive ? (
                <Upload className="w-12 h-12 text-blue-500" />
              ) : (
                <FileSpreadsheet className="w-10 h-10 text-green-500" />
              )}
            </div>
            {loading ? (
              <div>
                <p className="text-base font-medium text-gray-700 mb-1">Excel işleniyor...</p>
                <div className="mt-3 flex justify-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
            ) : isDragActive ? (
              <p className="text-base font-medium text-blue-600">Dosyayı bırakın</p>
            ) : (
              <>
                <p className="text-base font-medium text-gray-700 mb-1">
                  Dosyayı buraya sürükleyin veya tıklayın
                </p>
                <p className="text-sm text-gray-400">.xlsx, .xls — max 10 MB</p>
              </>
            )}
          </div>

          {/* Format card */}
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800">Excel şablonu</p>
              <p className="text-xs text-green-600">Kamarin, sipariş formu, IMPA destekli</p>
            </div>
            <a
              href="/rfq-template.xlsx"
              download
              className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors whitespace-nowrap"
            >
              İndir
            </a>
          </div>

          <p className="text-center text-sm text-gray-400">
            Ya da{" "}
            <a href="/rfq/new" className="text-blue-600 hover:underline font-medium">
              manuel olarak ürün ekleyin
            </a>
          </p>

          {error && <ErrorBox message={error} />}
        </div>
      )}

      {/* ═══════════════════════ STEP 2 — EXCEL: META + HEADER ROW ══════════════════ */}
      {step === 2 && apiResp && (
        <div className="space-y-6">
          {apiResp.priceColumnsDetected && (
            <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800">
                Excel&apos;de fiyat bilgisi tespit edildi. Bu yeni bir teklif olduğu için fiyatlar
                atlandı — tedarikçiler kendi fiyatlarını verecek.
              </p>
            </div>
          )}

          <MetaFields
            vessel={metaVessel} setVessel={setMetaVessel}
            company={metaCompany} setCompany={setMetaCompany}
            date={metaDate} setDate={setMetaDate}
            contact={metaContact} setContact={setMetaContact}
          />

          {/* Header row selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-700">Başlık Satırı</h2>
              {apiResp.headerConfidence === "high" ? (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  Otomatik tespit edildi
                </span>
              ) : (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  Lütfen kontrol edin
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Yeşil satır tespit edilen başlık. Yanlışsa doğru satırı tıklayın.
            </p>

            <div className="overflow-x-auto rounded-lg border border-gray-100">
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
                          className={`cursor-pointer transition-colors ${
                            isHeader
                              ? "bg-green-100 text-green-900 font-semibold"
                              : "hover:bg-blue-50 text-gray-600"
                          }`}
                        >
                          <td className="px-2 py-1 text-gray-400 w-8 select-none">{ri + 1}</td>
                          {row.slice(0, 8).map((cell, ci) => (
                            <td key={ci} className="px-2 py-1 max-w-[120px] truncate">
                              {cell || <span className="text-gray-200">—</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {apiResp.warnings.length > 0 && (
            <div className="space-y-2">
              {apiResp.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          <NavButtons
            onBack={reset}
            backLabel="Yeni Dosya"
            onNext={goToStep3Excel}
            nextLabel="Sütunları Ayarla →"
          />
        </div>
      )}

      {/* ═══════════════════════ STEP 3 — EXCEL: COLUMN MAPPING ════════════ */}
      {step === 3 && apiResp && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Sütun Eşleştirme</h2>
            <p className="text-xs text-gray-500 mb-5">
              Her sütun için hangi bilgiyi içerdiğini seçin. Fiyat veya kullanmak istemediğiniz
              sütunları &quot;Atla&quot; olarak işaretleyin.
            </p>

            <div className="space-y-2">
              {currentHeaders.map((header, ci) => {
                if (!header.trim()) return null;
                const current = fieldMap[ci] ?? null;
                return (
                  <div
                    key={ci}
                    className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0"
                  >
                    <span className="w-6 text-xs text-gray-400 text-center">{ci + 1}</span>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                      {header}
                    </span>
                    <span className="text-gray-300">→</span>
                    <select
                      value={current ?? ""}
                      onChange={(e) => {
                        const val = e.target.value as ParsedItemField | "price" | "ignore" | "";
                        setFieldMap((prev) => ({ ...prev, [ci]: val === "" ? null : val }));
                      }}
                      className={`text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[160px] ${
                        current === "price" || current === "ignore"
                          ? "border-gray-200 text-gray-400 bg-gray-50"
                          : current
                          ? "border-blue-200 text-blue-800 bg-blue-50"
                          : "border-amber-200 text-amber-700 bg-amber-50"
                      }`}
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
          </div>

          <NavButtons
            onBack={() => setStep(2)}
            onNext={goToStep4Excel}
            nextLabel="Ürünleri Önizle →"
          />
        </div>
      )}

      {/* ═══════════════════════ STEP 4: PRODUCT PREVIEW ════════════════════ */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-sm font-medium text-blue-800">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              {items.filter((i) => i.product_name.trim()).length} ürün hazır
              {skippedRows > 0 && (
                <span className="text-gray-500 font-normal ml-1">
                  — {skippedRows} satır atlandı (toplam/boş)
                </span>
              )}
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <X className="w-4 h-4" />
              Yeni dosya yükle
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 w-8">#</th>
                    {(
                      [
                        ["product_name", "Ürün Adı *"],
                        ["brand", "Marka"],
                        ["quantity", "Miktar"],
                        ["unit", "Birim"],
                        ["impa_code", "IMPA"],
                        ["description", "Açıklama"],
                      ] as [ParsedItemField, string][]
                    ).map(([, label]) => (
                      <th key={label} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">
                        {label}
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const rowError = !item.product_name.trim();
                    return (
                      <tr key={idx} className={rowError ? "bg-red-50" : "hover:bg-gray-50/50"}>
                        <td className="px-3 py-1.5 text-xs text-gray-400">{idx + 1}</td>
                        {(
                          ["product_name", "brand", "quantity", "unit", "impa_code", "description"] as ParsedItemField[]
                        ).map((field) => (
                          <td key={field} className="px-1.5 py-1.5">
                            <input
                              value={item[field]}
                              onChange={(e) => updateItem(idx, field, e.target.value)}
                              className={`w-full px-2 py-1 rounded border text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                field === "product_name" && rowError
                                  ? "border-red-400 bg-red-50"
                                  : "border-gray-200 bg-white"
                              }`}
                              placeholder={FIELD_LABELS[field]}
                            />
                          </td>
                        ))}
                        <td className="px-1.5 py-1.5">
                          <button
                            onClick={() => removeItem(idx)}
                            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
            <div className="px-4 py-3 border-t border-gray-100">
              <button
                onClick={addItem}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Yeni Satır Ekle
              </button>
            </div>
          </div>

          {error && <ErrorBox message={error} />}

          <div className="flex items-center gap-3 justify-between">
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Geri
            </button>
            <div className="flex items-center gap-3">
              <a
                href="/rfq/new"
                className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Manuel Ekle
              </a>
              <button
                onClick={handleConfirm}
                disabled={items.filter((i) => i.product_name.trim()).length === 0}
                className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold transition-colors"
              >
                Onayla ve Devam Et →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared Meta Fields ───────────────────────────────────────────────────────

function MetaFields({
  vessel, setVessel,
  company, setCompany,
  date, setDate,
  contact, setContact,
}: {
  vessel: string; setVessel: (v: string) => void;
  company: string; setCompany: (v: string) => void;
  date: string; setDate: (v: string) => void;
  contact: string; setContact: (v: string) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Tespit Edilen Bilgiler</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(
          [
            ["Gemi Adı", vessel, setVessel],
            ["Firma", company, setCompany],
            ["Tarih", date, setDate],
            ["İlgili Kişi", contact, setContact],
          ] as [string, string, (v: string) => void][]
        ).map(([label, val, setter]) => (
          <div key={label}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <input
              value={val}
              onChange={(e) => setter(e.target.value)}
              placeholder={`${label} (otomatik veya girin)`}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3">
        Bu bilgiler teklif başlığını ve notlarını otomatik dolduracak.
      </p>
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {message}
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
    <div className="flex items-center justify-between">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        {backLabel}
      </button>
      <button
        onClick={onNext}
        className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
      >
        {nextLabel}
      </button>
    </div>
  );
}

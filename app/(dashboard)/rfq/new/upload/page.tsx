"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  FileSpreadsheet,
  FileText,
  Trash2,
  Plus,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import type { ParsedItem, ParsedItemField } from "@/lib/rfq-parse/header-map";

const FIELD_LABELS: Record<ParsedItemField, string> = {
  product_name: "Ürün Adı",
  brand: "Marka",
  quantity: "Miktar",
  unit: "Birim",
  impa_code: "IMPA Kodu",
  description: "Açıklama",
};

const ALL_FIELDS: ParsedItemField[] = [
  "product_name",
  "brand",
  "quantity",
  "unit",
  "impa_code",
  "description",
];

interface ParseResponse {
  items: ParsedItem[];
  unmappedColumns: string[];
  sourceFileUrl: string | null;
  sourceType: "excel" | "pdf";
  warnings: string[];
}

function emptyItem(): ParsedItem {
  return { product_name: "", brand: "", quantity: "", unit: "", impa_code: "", description: "" };
}

export default function UploadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [items, setItems] = useState<ParsedItem[]>([]);
  // unmapped column → field eşleştirme
  const [colMapping, setColMapping] = useState<Record<string, ParsedItemField | "">>({});

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setParseResult(null);
    setLoading(true);

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

      const result: ParseResponse = json;
      setParseResult(result);
      setItems(result.items);

      const initMapping: Record<string, ParsedItemField | ""> = {};
      for (const col of result.unmappedColumns) initMapping[col] = "";
      setColMapping(initMapping);
    } catch {
      setError("Sunucuya bağlanılamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) handleFile(accepted[0]);
    },
    [handleFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (files) => {
      const err = files[0]?.errors[0];
      if (err?.code === "file-too-large") setError("Dosya 10 MB'den büyük olamaz.");
      else if (err?.code === "file-invalid-type") setError("Sadece .xlsx, .xls veya .pdf kabul edilir.");
      else setError("Geçersiz dosya.");
    },
  });

  const updateItem = (idx: number, field: ParsedItemField, value: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);

  const hasError = (item: ParsedItem) => !item.product_name.trim();
  const errorCount = items.filter(hasError).length;

  const handleConfirm = () => {
    if (items.filter((i) => i.product_name.trim()).length === 0) {
      setError("En az bir geçerli ürün olmalı.");
      return;
    }
    const validItems = items.filter((i) => i.product_name.trim());
    const payload = {
      items: validItems,
      sourceFileUrl: parseResult?.sourceFileUrl ?? null,
      sourceType: parseResult?.sourceType ?? "excel",
    };
    localStorage.setItem("rfq_upload_items", JSON.stringify(payload));
    router.push("/rfq/new?source=upload");
  };

  const reset = () => {
    setParseResult(null);
    setItems([]);
    setError("");
    setColMapping({});
  };

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
        <p className="text-gray-500 mt-1">Excel (.xlsx, .xls) veya metin tabanlı PDF yükleyin, ardından düzenleyin.</p>
      </div>

      {/* Adım 1 — Yükleme alanı */}
      {!parseResult && (
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
                <div className="flex gap-3">
                  <FileSpreadsheet className="w-10 h-10 text-green-500" />
                  <FileText className="w-10 h-10 text-red-400" />
                </div>
              )}
            </div>
            {loading ? (
              <div>
                <p className="text-base font-medium text-gray-700 mb-1">Dosyanız işleniyor...</p>
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
                <p className="text-sm text-gray-400">.xlsx, .xls, .pdf — max 10 MB</p>
              </>
            )}
          </div>

          {/* Şablon indir */}
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800">Örnek Excel şablonu</p>
              <p className="text-xs text-green-600">Hazır başlık satırı ile hızlıca doldurun</p>
            </div>
            <a
              href="/rfq-template.xlsx"
              download
              className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors flex-shrink-0"
            >
              İndir
            </a>
          </div>

          {/* Manuel yönlendirme */}
          <p className="text-center text-sm text-gray-400">
            Ya da{" "}
            <a href="/rfq/new" className="text-blue-600 hover:underline font-medium">
              manuel olarak ürün ekleyin
            </a>
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* Adım 2 — Önizleme ve düzenleme */}
      {parseResult && (
        <div className="space-y-4">
          {/* Özet başlık */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-4 py-2 rounded-xl text-sm font-medium text-blue-800">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              {items.length} ürün tespit edildi
              {errorCount > 0 && (
                <span className="text-red-600 ml-1">— {errorCount} tanesi hatalı</span>
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

          {/* Uyarılar */}
          {parseResult.warnings.length > 0 && (
            <div className="space-y-2">
              {parseResult.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Eşleşmeyen sütun uyarısı */}
          {parseResult.unmappedColumns.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Aşağıdaki sütunlar otomatik eşleştirilemedi:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {parseResult.unmappedColumns.map((col) => (
                  <div key={col} className="flex items-center gap-2">
                    <span className="text-sm text-amber-700 font-mono bg-amber-100 px-2 py-0.5 rounded flex-shrink-0">
                      {col}
                    </span>
                    <span className="text-xs text-amber-600">→</span>
                    <select
                      value={colMapping[col] ?? ""}
                      onChange={(e) =>
                        setColMapping((prev) => ({ ...prev, [col]: e.target.value as ParsedItemField | "" }))
                      }
                      className="flex-1 text-sm border border-amber-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">— Yoksay —</option>
                      {ALL_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {FIELD_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Düzenlenebilir tablo */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 w-8">#</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Ürün Adı *</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Marka</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Miktar</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Birim</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">IMPA</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500">Açıklama</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, idx) => {
                    const rowError = hasError(item);
                    return (
                      <tr
                        key={idx}
                        className={rowError ? "bg-red-50" : "hover:bg-gray-50/50"}
                      >
                        <td className="px-3 py-1.5 text-xs text-gray-400">{idx + 1}</td>
                        {(["product_name", "brand", "quantity", "unit", "impa_code", "description"] as ParsedItemField[]).map(
                          (field) => (
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
                          )
                        )}
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

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Alt butonlar */}
          <div className="flex items-center gap-3 justify-end">
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
      )}
    </div>
  );
}

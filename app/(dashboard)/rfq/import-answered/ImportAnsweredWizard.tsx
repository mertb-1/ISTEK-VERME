"use client";

import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Trash2,
  X,
  Scissors,
  Merge,
  EyeOff,
  Eye,
} from "lucide-react";
import {
  applyQuoteFieldMap,
  type QuoteParsedField,
  type QuoteParsedRow,
  type QuoteColumnSuggestion,
  type QuoteFieldMap,
} from "@/lib/rfq-parse/quote-import";
import {
  unifyProducts,
  type ProductGroup,
  type ProductGroupMember,
} from "@/lib/rfq-parse/quote-unify";
import type { RfqMeta } from "@/lib/rfq-parse/types";
import { formatMoney, SUPPORTED_CURRENCIES, CURRENCY_LABELS, type Currency } from "@/lib/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

type Supplier = {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string;
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

type FileEntry = {
  uid: string;
  fileName: string;
  supplierId: string;
  status: "parsing" | "ready" | "error";
  error: string;
  parseResp: ParseApiResponse | null;
  fieldMap: QuoteFieldMap;
};

type EditableGroup = ProductGroup & { ignored: boolean };

type Step = 1 | 2 | 3 | 4 | 5 | 6;

// ─── Constants ────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<QuoteParsedField | "ignore", string> = {
  product_name: "Ürün Adı",
  impa_code: "IMPA Kodu",
  offered_brand: "Teklif Edilen Marka",
  quantity: "Miktar",
  unit: "Birim",
  unit_price: "Birim Fiyat",
  total_price: "Toplam Fiyat",
  notes: "Not",
  ignore: "Bu sütunu kullanma",
};

const ASSIGNABLE_FIELDS: (QuoteParsedField | "ignore")[] = [
  "product_name", "impa_code", "offered_brand", "quantity", "unit",
  "unit_price", "total_price", "notes", "ignore",
];

const STEP_LABELS = ["Bilgiler", "Dosyalar", "Sütunlar", "Ürünler", "Önizleme", "Oluştur"];

const MAX_FILES = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Üyenin birim fiyatı: yoksa toplam ÷ miktar'dan türetilir
function memberUnitPrice(member: ProductGroupMember, group: ProductGroup): number | null {
  const row = member.row;
  if (row.unit_price != null) return row.unit_price;
  const qty = row.quantity ?? group.quantity;
  if (row.total_price != null && qty > 0) {
    return Math.round((row.total_price / qty) * 10000) / 10000;
  }
  return null;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-center mb-10 overflow-x-auto pb-1">
      {STEP_LABELS.map((label, i) => {
        const stepNum = (i + 1) as Step;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <Fragment key={i}>
            {i > 0 && (
              <div className="flex-1 h-px mx-2 min-w-[12px]" style={{ background: done ? "#8b3a2a" : "#e6ddd4" }} />
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

export default function ImportAnsweredWizard({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");

  // Step 1
  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [notes, setNotes] = useState("");

  // Step 2-3
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFileUid, setActiveFileUid] = useState<string>("");

  // Step 4
  const [groups, setGroups] = useState<EditableGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const groupSeq = useRef(0);

  // Step 6
  const [creating, setCreating] = useState(false);
  const [payloadPreview, setPayloadPreview] = useState("");

  const fmt = (n: number | null | undefined) => formatMoney(n, currency);
  const supplierById = useMemo(() => {
    const m = new Map<string, Supplier>();
    for (const s of suppliers) m.set(s.id, s);
    return m;
  }, [suppliers]);

  const usedSupplierIds = useMemo(() => {
    const s = new Set<string>();
    for (const f of files) if (f.supplierId) s.add(f.supplierId);
    return s;
  }, [files]);

  // ── Step 2: dosya yükleme ───────────────────────────────────────────────────

  const parseFile = useCallback(async (file: File, uid: string) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/quote/parse-file", { method: "POST", body: fd });
      const json = await res.json();
      setFiles((prev) =>
        prev.map((f) => {
          if (f.uid !== uid) return f;
          if (!res.ok) return { ...f, status: "error", error: json.error ?? "Dosya işlenemedi." };
          const resp = json as ParseApiResponse;
          const map: QuoteFieldMap = {};
          for (const s of resp.columnSuggestions) map[s.colIndex] = s.suggestedField;
          return { ...f, status: "ready", parseResp: resp, fieldMap: map };
        })
      );
    } catch {
      setFiles((prev) =>
        prev.map((f) => (f.uid === uid ? { ...f, status: "error", error: "Sunucuya bağlanılamadı." } : f))
      );
    }
  }, []);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError("");
      const room = MAX_FILES - files.length;
      if (accepted.length > room) {
        setError(`En fazla ${MAX_FILES} dosya yükleyebilirsiniz.`);
      }
      for (const file of accepted.slice(0, room)) {
        const uid = `f${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setFiles((prev) => [
          ...prev,
          { uid, fileName: file.name, supplierId: "", status: "parsing", error: "", parseResp: null, fieldMap: {} },
        ]);
        parseFile(file, uid);
      }
    },
    [files.length, parseFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (rejected) => {
      const code = rejected[0]?.errors[0]?.code;
      if (code === "file-too-large") setError("Dosya 10 MB'den büyük olamaz.");
      else if (code === "file-invalid-type") setError("Sadece .xlsx, .xls ve .csv formatları kabul edilir.");
      else setError("Geçersiz dosya.");
    },
  });

  const removeFile = (uid: string) => setFiles((prev) => prev.filter((f) => f.uid !== uid));

  const setFileSupplier = (uid: string, supplierId: string) =>
    setFiles((prev) => prev.map((f) => (f.uid === uid ? { ...f, supplierId } : f)));

  const setFileFieldMap = (uid: string, colIdx: number, field: QuoteParsedField | "ignore" | null) =>
    setFiles((prev) =>
      prev.map((f) => (f.uid === uid ? { ...f, fieldMap: { ...f.fieldMap, [colIdx]: field } } : f))
    );

  // ── Adım geçişleri ──────────────────────────────────────────────────────────

  const goToStep2 = () => {
    if (!title.trim()) { setError("Başlık gerekli."); return; }
    setError("");
    setStep(2);
  };

  const goToStep3 = () => {
    if (files.length === 0) { setError("En az bir teklif dosyası yükleyin."); return; }
    if (files.some((f) => f.status === "parsing")) { setError("Dosyalar hâlâ işleniyor, lütfen bekleyin."); return; }
    if (files.some((f) => f.status === "error")) { setError("Hatalı dosyaları kaldırın veya yeniden yükleyin."); return; }
    if (files.some((f) => !f.supplierId)) { setError("Her dosyaya bir tedarikçi atayın."); return; }
    setError("");
    setActiveFileUid(files[0].uid);
    setStep(3);
  };

  const goToStep4 = () => {
    for (const f of files) {
      const mapped = Object.values(f.fieldMap);
      const hasName = mapped.includes("product_name");
      const hasPrice = mapped.includes("unit_price") || mapped.includes("total_price");
      const supplierName = supplierById.get(f.supplierId)?.company_name ?? f.fileName;
      if (!hasName) { setError(`${supplierName}: Ürün Adı sütunu eşleştirilmedi.`); setActiveFileUid(f.uid); return; }
      if (!hasPrice) { setError(`${supplierName}: en az bir fiyat sütunu eşleştirin.`); setActiveFileUid(f.uid); return; }
    }
    setError("");

    // Tüm dosyaları parse edip birleştir — adım 4'e her girişte yeniden hesaplanır
    // (3. adımda sütun map'i değişmiş olabilir; manuel grup düzenlemeleri sıfırlanır)
    const parsedFiles = files.map((f) => {
      const { rows } = applyQuoteFieldMap(f.parseResp!.allRawRows, f.parseResp!.headerRowIdx, f.fieldMap);
      return { supplier_id: f.supplierId, rows };
    });
    const unified = unifyProducts(parsedFiles);
    if (unified.length === 0) {
      setError("Dosyalardan ürün çıkarılamadı. Sütun eşleştirmelerini kontrol edin.");
      return;
    }
    groupSeq.current = unified.length;
    setGroups(unified.map((g) => ({ ...g, ignored: false })));
    setSelectedGroups(new Set());
    setStep(4);
  };

  // ── Step 4: grup düzenleme ──────────────────────────────────────────────────

  const activeGroups = groups.filter((g) => !g.ignored);

  const updateGroup = (tempId: string, patch: Partial<EditableGroup>) =>
    setGroups((prev) => prev.map((g) => (g.temp_id === tempId ? { ...g, ...patch } : g)));

  const toggleIgnore = (tempId: string) =>
    setGroups((prev) => prev.map((g) => (g.temp_id === tempId ? { ...g, ignored: !g.ignored } : g)));

  const toggleSelect = (tempId: string) =>
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });

  const splitMember = (tempId: string, memberIdx: number) => {
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.temp_id === tempId);
      if (idx < 0) return prev;
      const group = prev[idx];
      if (group.members.length < 2) return prev;
      const member = group.members[memberIdx];
      groupSeq.current += 1;
      const fresh: EditableGroup = {
        temp_id: `g${groupSeq.current}`,
        product_name: member.row.product_name || group.product_name,
        quantity: member.row.quantity ?? 1,
        unit: member.row.unit.trim() || "adet",
        impa_code: null,
        members: [member],
        name_variants: member.row.product_name ? [member.row.product_name] : [],
        quantity_conflict: false,
        ignored: false,
      };
      const updated: EditableGroup = {
        ...group,
        members: group.members.filter((_, i) => i !== memberIdx),
      };
      const next = [...prev];
      next[idx] = updated;
      next.splice(idx + 1, 0, fresh);
      return next;
    });
  };

  const mergeSelected = () => {
    if (selectedGroups.size < 2) { setError("Birleştirmek için en az iki grup seçin."); return; }
    const targets = groups.filter((g) => selectedGroups.has(g.temp_id) && !g.ignored);
    // Güvenlik: aynı tedarikçi iki grupta varsa birleştirilemez (bir kaleme tek fiyat)
    const seen = new Set<string>();
    for (const g of targets) {
      for (const m of g.members) {
        if (seen.has(m.supplier_id)) {
          const name = supplierById.get(m.supplier_id)?.company_name ?? "Tedarikçi";
          setError(`Birleştirilemez: ${name} seçilen birden fazla grupta fiyat vermiş.`);
          return;
        }
        seen.add(m.supplier_id);
      }
    }
    setError("");
    setGroups((prev) => {
      const [first, ...rest] = prev.filter((g) => selectedGroups.has(g.temp_id) && !g.ignored);
      if (!first) return prev;
      const merged: EditableGroup = {
        ...first,
        members: [...first.members, ...rest.flatMap((g) => g.members)],
        name_variants: Array.from(new Set([...first.name_variants, ...rest.flatMap((g) => g.name_variants)])),
        impa_code: first.impa_code ?? rest.find((g) => g.impa_code)?.impa_code ?? null,
        quantity_conflict:
          first.quantity_conflict ||
          rest.some((g) => g.quantity_conflict) ||
          rest.some((g) => g.members.some((m) => m.row.quantity != null && m.row.quantity !== first.quantity)),
      };
      const restIds = new Set(rest.map((g) => g.temp_id));
      return prev.filter((g) => !restIds.has(g.temp_id)).map((g) => (g.temp_id === first.temp_id ? merged : g));
    });
    setSelectedGroups(new Set());
  };

  const goToStep5 = () => {
    const usable = activeGroups.filter((g) => g.members.some((m) => memberUnitPrice(m, g) != null));
    if (usable.length === 0) { setError("Karşılaştırmaya girecek fiyatlı ürün yok."); return; }
    // Her dosyanın en az bir fiyatlı kalemi kalmalı (API şartı)
    for (const f of files) {
      const has = activeGroups.some((g) =>
        g.members.some((m) => m.supplier_id === f.supplierId && memberUnitPrice(m, g) != null)
      );
      if (!has) {
        const name = supplierById.get(f.supplierId)?.company_name ?? f.fileName;
        setError(`${name}: hiçbir fiyatlı kalemi karşılaştırmada kalmadı. Grupları kontrol edin veya dosyayı çıkarın.`);
        return;
      }
    }
    setError("");
    setStep(5);
  };

  // ── Payload + oluşturma ─────────────────────────────────────────────────────

  const buildPayload = () => {
    const items = activeGroups.map((g, idx) => ({
      temp_id: g.temp_id,
      order_no: idx + 1,
      product_name: g.product_name,
      quantity: g.quantity,
      unit: g.unit,
      impa_code: g.impa_code,
      brand: null as string | null,
      description: null as string | null,
    }));

    const supplierQuotes = files.map((f) => {
      const quoteItems = activeGroups
        .map((g) => {
          const member = g.members.find((m) => m.supplier_id === f.supplierId);
          if (!member) return null;
          const unitPrice = memberUnitPrice(member, g);
          if (unitPrice == null) return null;
          return {
            item_temp_id: g.temp_id,
            unit_price: unitPrice,
            total_price: member.row.total_price ?? Math.round(unitPrice * g.quantity * 100) / 100,
            offered_brand: member.row.offered_brand || null,
            notes: member.row.notes || null,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return {
        supplier_id: f.supplierId,
        source_file_url: f.parseResp?.sourceFileUrl ?? null,
        delivery_time: null as string | null,
        payment_terms: null as string | null,
        supplier_notes: null as string | null,
        items: quoteItems,
        import_raw: {
          file_name: f.fileName,
          header_row_idx: f.parseResp?.headerRowIdx ?? 0,
          field_map: f.fieldMap,
          matched_rows: quoteItems.length,
        },
      };
    });

    return { title: title.trim(), currency, notes: notes.trim() || null, items, supplierQuotes };
  };

  const handleCreate = async () => {
    setCreating(true);
    setError("");
    setPayloadPreview("");
    const payload = buildPayload();
    try {
      const res = await fetch("/api/rfq/import-answered", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Karşılaştırma oluşturulamadı.");
        return;
      }
      if (data.rfq_id) {
        // Insert fazı devrede: doğrudan karşılaştırma tablosuna git
        router.push(`/rfq/${data.rfq_id}`);
        return;
      }
      // Endpoint henüz yalnızca doğruluyor — payload önizleme göster
      console.log("[import-answered] payload:", payload, "response:", data);
      setPayloadPreview(JSON.stringify(data.summary ?? payload, null, 2));
    } catch {
      setError("Bağlantı hatası. Lütfen tekrar deneyin.");
    } finally {
      setCreating(false);
    }
  };

  // ── Önizleme verileri (Adım 5-6) ───────────────────────────────────────────

  const supplierColumns = files
    .map((f) => ({ supplierId: f.supplierId, supplier: supplierById.get(f.supplierId) }))
    .filter((c): c is { supplierId: string; supplier: Supplier } => !!c.supplier);

  const supplierTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const c of supplierColumns) totals.set(c.supplierId, 0);
    for (const g of activeGroups) {
      for (const m of g.members) {
        const p = memberUnitPrice(m, g);
        if (p != null && totals.has(m.supplier_id)) {
          totals.set(m.supplier_id, (totals.get(m.supplier_id) ?? 0) + p * g.quantity);
        }
      }
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, files]);

  const activeFile = files.find((f) => f.uid === activeFileUid) ?? files[0];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl">
      {/* Breadcrumb */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: "#b0a49e" }}>
          <Link href="/rfq" className="hover:underline" style={{ color: "#7a6e67" }}>Tekliflerim</Link>
          <ChevronRight className="w-3 h-3" />
          <span>Cevaplanmış Teklif Yükle</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#111", fontFamily: "'Playfair Display', Georgia, serif" }}>
          Cevaplanmış Tekliflerden Karşılaştırma
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#7a6e67" }}>
          Tedarikçilerden gelen cevaplanmış Excel tekliflerini yükleyerek sıfırdan karşılaştırma tablosu oluşturun.
        </p>
      </div>

      <Stepper current={step} />

      {/* ═══════════════════ STEP 1: TEMEL BİLGİLER ══════════════════════════ */}
      {step === 1 && (
        <div className="space-y-5">
          <Card title="Karşılaştırma Bilgileri">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                  Başlık <span style={{ color: "#8b3a2a" }}>*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="örn. Mart Kumanya Karşılaştırması"
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                  style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                  Para Birimi
                </label>
                <div className="flex gap-2">
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                      style={
                        currency === c
                          ? { background: "#111", color: "#fff" }
                          : { background: "#fff", color: "#7a6e67", border: "1px solid #e6ddd4" }
                      }
                    >
                      {CURRENCY_LABELS[c] ?? c}
                    </button>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: "#b0a49e" }}>
                  Tüm dosyalardaki fiyatlar bu para biriminde kabul edilir; dönüşüm yapılmaz.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                  Not <span style={{ color: "#b0a49e" }}>(opsiyonel)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none resize-none"
                  style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>
            </div>
          </Card>

          {error && <ErrorBox message={error} />}

          <div className="flex justify-end pt-1">
            <button
              onClick={goToStep2}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: "#111" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#111")}
            >
              Dosyalara Geç
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════ STEP 2: DOSYALAR ════════════════════════════════ */}
      {step === 2 && (
        <div className="space-y-5">
          {suppliers.length === 0 && (
            <InfoBox>
              Kayıtlı tedarikçiniz yok.{" "}
              <Link href="/suppliers" className="font-semibold hover:underline" style={{ color: "#8b3a2a" }}>
                Önce tedarikçi ekleyin
              </Link>{" "}
              — her dosya bir tedarikçiye atanmalıdır.
            </InfoBox>
          )}

          {/* Drop zone */}
          <div
            {...getRootProps()}
            className="rounded-2xl text-center cursor-pointer transition-all"
            style={
              isDragActive
                ? { border: "2px dashed #8b3a2a", background: "#fdf5f0", padding: "2.5rem 2rem" }
                : { border: "2px dashed #d4c5b8", background: "#faf4ee", padding: "2.5rem 2rem" }
            }
          >
            <input {...getInputProps()} />
            {isDragActive ? (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10" style={{ color: "#8b3a2a" }} />
                <p className="text-base font-semibold" style={{ color: "#8b3a2a" }}>Dosyaları bırakın</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "#f5f0eb" }}>
                  <FileSpreadsheet className="w-6 h-6" style={{ color: "#8b3a2a" }} />
                </div>
                <div>
                  <p className="text-base font-semibold" style={{ color: "#111" }}>
                    Teklif dosyalarını buraya sürükleyin
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: "#7a6e67" }}>
                    Birden fazla dosya seçebilirsiniz — her dosya bir tedarikçinin teklifi
                  </p>
                </div>
                <span className="text-xs px-3 py-1 rounded-full" style={{ background: "#f0e9e2", color: "#b0a49e" }}>
                  .xlsx, .xls ve .csv — maks. 10 MB, en fazla {MAX_FILES} dosya
                </span>
              </div>
            )}
          </div>

          {/* Dosya listesi */}
          {files.length > 0 && (
            <Card title="Yüklenen Dosyalar" badge={{ text: `${files.length} dosya`, color: "green" }}>
              <div className="space-y-2">
                {files.map((f) => (
                  <div
                    key={f.uid}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl flex-wrap"
                    style={{ background: f.status === "error" ? "#fdf0ee" : "#faf4ee" }}
                  >
                    <FileSpreadsheet className="w-4 h-4 flex-shrink-0" style={{ color: f.status === "error" ? "#8b3a2a" : "#7a6e67" }} />
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-medium truncate" style={{ color: "#111" }}>{f.fileName}</p>
                      {f.status === "parsing" && (
                        <p className="text-xs" style={{ color: "#b0a49e" }}>İşleniyor...</p>
                      )}
                      {f.status === "error" && (
                        <p className="text-xs font-medium" style={{ color: "#8b3a2a" }}>{f.error}</p>
                      )}
                      {f.status === "ready" && f.parseResp && (
                        <p className="text-xs" style={{ color: "#7a6e67" }}>
                          {f.parseResp.previewRows.length} kalem bulundu
                          {f.parseResp.priceColumnDetected ? (
                            <span style={{ color: "#1a7a3a" }}> · fiyat sütunu tespit edildi</span>
                          ) : (
                            <span style={{ color: "#a06a00" }}> · fiyat sütunu bulunamadı</span>
                          )}
                        </p>
                      )}
                    </div>

                    {f.status === "ready" && (
                      <select
                        value={f.supplierId}
                        onChange={(e) => setFileSupplier(f.uid, e.target.value)}
                        className="text-sm rounded-lg px-3 py-1.5 focus:outline-none min-w-[200px] cursor-pointer"
                        style={
                          f.supplierId
                            ? { border: "1.5px solid #8b3a2a", background: "#fff", color: "#8b3a2a" }
                            : { border: "1.5px solid #e8a090", background: "#fff", color: "#8b3a2a" }
                        }
                      >
                        <option value="">— Tedarikçi seçin —</option>
                        {suppliers.map((s) => (
                          <option
                            key={s.id}
                            value={s.id}
                            disabled={usedSupplierIds.has(s.id) && f.supplierId !== s.id}
                          >
                            {s.company_name}
                            {usedSupplierIds.has(s.id) && f.supplierId !== s.id ? " — başka dosyada" : ""}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      onClick={() => removeFile(f.uid)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0"
                      style={{ color: "#b0a49e" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#fdf0ee"; e.currentTarget.style.color = "#8b3a2a"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#b0a49e"; }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {error && <ErrorBox message={error} />}

          <NavButtons onBack={() => setStep(1)} onNext={goToStep3} nextLabel="Sütunları Ayarla" />
        </div>
      )}

      {/* ═══════════════════ STEP 3: SÜTUN EŞLEŞTİRME (DOSYA BAŞINA) ═════════ */}
      {step === 3 && activeFile && (
        <div className="space-y-5">
          {/* Dosya sekmeleri */}
          <div className="flex items-center gap-2 flex-wrap">
            {files.map((f) => {
              const isActive = f.uid === activeFile.uid;
              const supplierName = supplierById.get(f.supplierId)?.company_name ?? f.fileName;
              const mapped = Object.values(f.fieldMap);
              const ok = mapped.includes("product_name") && (mapped.includes("unit_price") || mapped.includes("total_price"));
              return (
                <button
                  key={f.uid}
                  onClick={() => setActiveFileUid(f.uid)}
                  className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors"
                  style={
                    isActive
                      ? { background: "#111", color: "#fff" }
                      : { background: "#fff", color: "#7a6e67", border: "1px solid #e6ddd4" }
                  }
                >
                  {ok ? (
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: isActive ? "#7fd49a" : "#1a7a3a" }} />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5" style={{ color: isActive ? "#f3d87c" : "#a06a00" }} />
                  )}
                  {supplierName}
                </button>
              );
            })}
          </div>

          <Card
            title={`Sütun Eşleştirme — ${supplierById.get(activeFile.supplierId)?.company_name ?? activeFile.fileName}`}
            badge={
              activeFile.parseResp?.priceColumnDetected
                ? { text: "Fiyat sütunu bulundu", color: "green" }
                : { text: "Fiyat sütununu elle seçin", color: "amber" }
            }
          >
            <p className="text-xs mb-5" style={{ color: "#7a6e67" }}>
              Her dosya için Ürün Adı ve en az bir fiyat sütunu gereklidir.
            </p>
            <div className="space-y-1">
              {(activeFile.parseResp?.allRawRows[activeFile.parseResp.headerRowIdx] ?? []).map((header, ci) => {
                if (!header.trim()) return null;
                const raw = activeFile.fieldMap[ci];
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
                    <span className="flex-1 text-sm font-medium truncate" style={{ color: "#111" }}>{header}</span>
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
                        setFileFieldMap(activeFile.uid, ci, val === "" ? null : val);
                      }}
                      className="text-sm rounded-lg px-3 py-1.5 focus:outline-none min-w-[180px] cursor-pointer"
                      style={
                        isMapped
                          ? { border: "1.5px solid #8b3a2a", background: "#fff", color: "#8b3a2a" }
                          : { border: "1.5px solid #e6ddd4", background: "#fff", color: "#b0a49e" }
                      }
                    >
                      <option value="">— Eşleştirilmedi —</option>
                      {ASSIGNABLE_FIELDS.map((fl) => (
                        <option key={fl} value={fl}>{FIELD_LABELS[fl]}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </Card>

          {error && <ErrorBox message={error} />}

          <NavButtons onBack={() => setStep(2)} onNext={goToStep4} nextLabel="Ürünleri Birleştir" />
        </div>
      )}

      {/* ═══════════════════ STEP 4: ÜRÜN BİRLEŞTİRME ════════════════════════ */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-2 text-sm font-semibold px-3.5 py-2 rounded-xl" style={{ background: "#edf8f1", color: "#1a7a3a" }}>
                <CheckCircle2 className="w-4 h-4" />
                {activeGroups.length} ürün grubu
              </span>
              {groups.some((g) => g.quantity_conflict && !g.ignored) && (
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "#fef5e4", color: "#a06a00" }}>
                  <AlertCircle className="w-3 h-3" />
                  miktar çelişkisi olan gruplar var
                </span>
              )}
            </div>
            <button
              onClick={mergeSelected}
              disabled={selectedGroups.size < 2}
              className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-opacity disabled:opacity-40"
              style={{ background: "#fff", color: "#111", border: "1px solid #e6ddd4" }}
            >
              <Merge className="w-4 h-4" style={{ color: "#8b3a2a" }} />
              Seçilenleri Birleştir ({selectedGroups.size})
            </button>
          </div>

          <div className="space-y-2.5">
            {groups.map((g) => {
              const conflict = g.quantity_conflict && !g.ignored;
              return (
                <div
                  key={g.temp_id}
                  className="rounded-2xl px-4 py-3.5 transition-opacity"
                  style={{
                    border: conflict ? "1px solid #f3d87c" : "1px solid #e6ddd4",
                    background: g.ignored ? "#faf4ee" : "#fff",
                    opacity: g.ignored ? 0.55 : 1,
                  }}
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(g.temp_id)}
                      onChange={() => toggleSelect(g.temp_id)}
                      disabled={g.ignored}
                      className="mt-2.5 w-4 h-4 cursor-pointer accent-[#8b3a2a]"
                    />
                    <div className="flex-1 min-w-[220px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          value={g.product_name}
                          onChange={(e) => updateGroup(g.temp_id, { product_name: e.target.value })}
                          disabled={g.ignored}
                          className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-lg text-sm font-medium focus:outline-none"
                          style={{ border: "1px solid #e6ddd4", background: g.ignored ? "transparent" : "#fff", color: "#111" }}
                        />
                        <input
                          type="number"
                          step="any"
                          value={g.quantity}
                          onChange={(e) => updateGroup(g.temp_id, { quantity: parseFloat(e.target.value) || 1, quantity_conflict: false })}
                          disabled={g.ignored}
                          className="w-20 px-2 py-1.5 rounded-lg text-sm text-right focus:outline-none"
                          style={{ border: conflict ? "1.5px solid #f3d87c" : "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                        />
                        <input
                          value={g.unit}
                          onChange={(e) => updateGroup(g.temp_id, { unit: e.target.value })}
                          disabled={g.ignored}
                          className="w-20 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                          style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                        />
                        {g.impa_code && (
                          <span className="text-xs px-2 py-1 rounded-full" style={{ background: "#f5f0eb", color: "#7a6e67" }}>
                            IMPA {g.impa_code}
                          </span>
                        )}
                      </div>

                      {conflict && (
                        <p className="text-xs mt-1.5 font-medium" style={{ color: "#a06a00" }}>
                          Dosyalar farklı miktar bildiriyor — geçerli miktarı kontrol edin.
                        </p>
                      )}
                      {g.name_variants.length > 1 && (
                        <p className="text-xs mt-1.5" style={{ color: "#b0a49e" }}>
                          Diğer adlar: {g.name_variants.slice(1).join(" · ")}
                        </p>
                      )}

                      {/* Üyeler */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {g.members.map((m, mi) => {
                          const s = supplierById.get(m.supplier_id);
                          const p = memberUnitPrice(m, g);
                          return (
                            <span
                              key={mi}
                              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                              style={{ background: "#f5f0eb", color: "#7a6e67" }}
                            >
                              <span className="font-semibold" style={{ color: "#8b3a2a" }}>
                                {s?.company_name ?? "?"}
                              </span>
                              {p != null ? fmt(p) : "fiyat yok"}
                              {g.members.length > 1 && !g.ignored && (
                                <button
                                  onClick={() => splitMember(g.temp_id, mi)}
                                  title="Bu tedarikçiyi ayrı gruba ayır"
                                  className="ml-0.5 transition-colors"
                                  style={{ color: "#b0a49e" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = "#8b3a2a")}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = "#b0a49e")}
                                >
                                  <Scissors className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      onClick={() => toggleIgnore(g.temp_id)}
                      title={g.ignored ? "Karşılaştırmaya dahil et" : "Karşılaştırmadan çıkar"}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0 mt-1"
                      style={{ background: "#f5f0eb", color: "#7a6e67" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#ede5dd")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f0eb")}
                    >
                      {g.ignored ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {g.ignored ? "Dahil et" : "Çıkar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <ErrorBox message={error} />}

          <NavButtons onBack={() => setStep(3)} onNext={goToStep5} nextLabel="Önizlemeye Geç" />
        </div>
      )}

      {/* ═══════════════════ STEP 5: KARŞILAŞTIRMA ÖNİZLEME ══════════════════ */}
      {step === 5 && (
        <div className="space-y-5">
          <Card title="Karşılaştırma Önizleme" badge={{ text: `${activeGroups.length} kalem × ${supplierColumns.length} tedarikçi`, color: "green" }}>
            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e6ddd4" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold" style={{ color: "#7a6e67" }}>Ürün</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: "#7a6e67" }}>Miktar</th>
                    {supplierColumns.map((c) => (
                      <th key={c.supplierId} className="text-right px-4 py-3 text-xs font-semibold whitespace-nowrap" style={{ color: "#7a6e67" }}>
                        {c.supplier.company_name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeGroups.map((g) => (
                    <tr key={g.temp_id} style={{ borderBottom: "1px solid #f0e9e2" }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: "#111" }}>{g.product_name}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap" style={{ color: "#7a6e67" }}>
                        {g.quantity} {g.unit}
                      </td>
                      {supplierColumns.map((c) => {
                        const member = g.members.find((m) => m.supplier_id === c.supplierId);
                        const p = member ? memberUnitPrice(member, g) : null;
                        return (
                          <td key={c.supplierId} className="px-4 py-2.5 text-right tabular-nums" style={{ color: p != null ? "#111" : "#d4c5b8" }}>
                            {p != null ? fmt(p) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#faf4ee", borderTop: "2px solid #e6ddd4" }}>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: "#111" }} colSpan={2}>Toplam</td>
                    {supplierColumns.map((c) => (
                      <td key={c.supplierId} className="px-4 py-3 text-right tabular-nums font-bold" style={{ color: "#1a7a3a" }}>
                        {fmt(supplierTotals.get(c.supplierId) ?? 0)}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs mt-3" style={{ color: "#b0a49e" }}>
              Toplamlar birim fiyat × miktar üzerinden hesaplanır. &quot;—&quot; o tedarikçinin o kaleme fiyat vermediğini gösterir.
            </p>
          </Card>

          {error && <ErrorBox message={error} />}

          <NavButtons onBack={() => setStep(4)} onNext={() => { setError(""); setStep(6); }} nextLabel="Özete Geç" />
        </div>
      )}

      {/* ═══════════════════ STEP 6: OLUŞTUR ═════════════════════════════════ */}
      {step === 6 && (
        <div className="space-y-5">
          <Card title="Özet">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SummaryStat label="Başlık" value={title} />
              <SummaryStat label="Para birimi" value={currency} />
              <SummaryStat label="Ürün" value={`${activeGroups.length} kalem`} />
              <SummaryStat label="Tedarikçi" value={`${supplierColumns.length} dosya`} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              {supplierColumns.map((c) => (
                <SummaryStat
                  key={c.supplierId}
                  label={c.supplier.company_name}
                  value={fmt(supplierTotals.get(c.supplierId) ?? 0)}
                  strong
                />
              ))}
            </div>
          </Card>

          {payloadPreview && (
            <Card title="Doğrulama Sonucu" badge={{ text: "Henüz kaydedilmedi", color: "amber" }}>
              <div
                className="flex items-start gap-2.5 text-sm px-4 py-3 rounded-xl mb-4"
                style={{ background: "#fef5e4", color: "#a06a00", border: "1px solid #f3d87c" }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                Sunucu doğrulaması başarılı, ancak kayıt fazı henüz devrede değil — veritabanına hiçbir şey
                yazılmadı. Kayıt mantığı eklendiğinde bu buton karşılaştırmayı gerçekten oluşturacak.
              </div>
              <pre
                className="text-xs p-4 rounded-xl overflow-x-auto max-h-[320px] overflow-y-auto"
                style={{ background: "#faf4ee", color: "#111", border: "1px solid #e6ddd4" }}
              >
                {payloadPreview}
              </pre>
              <button
                onClick={() => setPayloadPreview("")}
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium transition-colors px-3 py-1.5 rounded-lg"
                style={{ color: "#7a6e67", background: "#f5f0eb" }}
              >
                <X className="w-3.5 h-3.5" />
                Kapat
              </button>
            </Card>
          )}

          {error && <ErrorBox message={error} />}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setStep(5)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ border: "1px solid #e6ddd4", color: "#7a6e67" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#faf4ee")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ChevronLeft className="w-4 h-4" />
              Geri
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ background: "#111" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2a2a2a")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#111")}
            >
              {creating ? "Oluşturuluyor..." : "Karşılaştırmayı Oluştur"}
              {!creating && <ArrowRight className="w-4 h-4" />}
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
      <p className="text-xs truncate" style={{ color: "#b0a49e" }} title={label}>{label}</p>
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex items-start gap-2.5 text-sm px-4 py-3.5 rounded-xl"
      style={{ background: "#faf4ee", color: "#7a6e67", border: "1px solid #e6ddd4" }}
    >
      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#b0a49e" }} />
      <span>{children}</span>
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
        className="flex items-center gap-3 px-5 py-3.5 flex-wrap"
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

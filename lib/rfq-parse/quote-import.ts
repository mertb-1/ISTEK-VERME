import { normalizeForMatch, isSkipRow, HIDDEN_COLUMN_KEYWORDS } from "./keywords";

// Cevaplanmış tedarikçi teklifi (quote import) için alan seti.
// RFQ parser'ından farkı: fiyat sütunları birinci sınıf alandır.
export type QuoteParsedField =
  | "product_name"
  | "impa_code"
  | "offered_brand"
  | "quantity"
  | "unit_price"
  | "total_price"
  | "notes";

export interface QuoteColumnSuggestion {
  colIndex: number;
  header: string;
  suggestedField: QuoteParsedField | "ignore" | null;
}

export interface QuoteParsedRow {
  /** Excel satır numarası (1 tabanlı) — denetim ve import_raw snapshot'ı için */
  source_row: number;
  product_name: string;
  impa_code: string;
  offered_brand: string;
  notes: string;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
}

export type QuoteFieldMap = Record<number, QuoteParsedField | "ignore" | null>;

// total_price, unit_price'tan ÖNCE denenir: "toplam fiyat" / "total amount" gibi
// başlıklar genel "fiyat" / "price" fallback'ine düşmeden toplam olarak yakalanır.
const QUOTE_FIELD_ORDER: QuoteParsedField[] = [
  "impa_code",
  "quantity",
  "offered_brand",
  "total_price",
  "unit_price",
  "notes",
  "product_name",
];

export const QUOTE_FIELD_KEYWORDS: Record<QuoteParsedField, string[]> = {
  product_name: [
    "gemi istek", "urun adi", "urun", "malzeme", "product name",
    "description", "product", "item", "type & description", "type &",
    "malzemenin cinsi", "tanim",
  ],
  impa_code: ["impa", "impa/issa", "impa code", "issa", "impa no", "issa code", "issa no"],
  offered_brand: ["teklif marka", "offered brand", "marka", "brand", "make", "manufacturer", "uretici"],
  quantity: ["miktar", "qty", "qtty", "q.ty", "quantity", "adet", "talep"],
  total_price: [
    "toplam tutar", "total amount", "total price", "line total",
    "toplam", "total", "tutar", "amount",
  ],
  unit_price: [
    "birim fiyat", "birim f", "u.price", "unit price", "u.fiyat",
    "unit cost", "rate", "fiyat", "price",
  ],
  notes: ["not", "remark", "remarks", "notlar", "aciklama", "detail", "detay"],
};

/**
 * Yerel sayı formatlarını çözer: "1.234,56" (TR), "1,234.56" (EN), "1234.56",
 * para birimi sembolleri/kodları ("$ 12.50", "12,50 TL") ayıklanır.
 * Sayı çıkmazsa null döner.
 */
export function parseLocaleNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw
    .replace(/usd|eur|gbp|try|tl|us\$|[€$£₺]/gi, "")
    .replace(/[\s ]/g, "")
    .replace(/[^0-9.,-]/g, "");
  if (!/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");

  if (lastDot !== -1 && lastComma !== -1) {
    // İki ayraç birlikte: sonda olan ondalık ayracıdır
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1) {
    const count = (s.match(/,/g) ?? []).length;
    // "1,234" / "1,234,567" → binlik; "1234,56" → ondalık
    if (count > 1 || /^-?\d{1,3}(,\d{3})+$/.test(s)) {
      s = s.replace(/,/g, "");
    } else {
      s = s.replace(/,/g, ".");
    }
  } else if (lastDot !== -1) {
    const count = (s.match(/\./g) ?? []).length;
    // "1.234" / "1.234.567" → binlik; "1234.56" → ondalık
    if (count > 1 || /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function suggestQuoteColumns(headers: string[]): {
  suggestions: QuoteColumnSuggestion[];
  priceColumnDetected: boolean;
} {
  const usedFields = new Set<QuoteParsedField>();
  let priceColumnDetected = false;

  const suggestions: QuoteColumnSuggestion[] = headers.map((header, colIndex) => {
    const h = normalizeForMatch(header);
    if (!h) return { colIndex, header, suggestedField: "ignore" as const };
    if (HIDDEN_COLUMN_KEYWORDS.some((k) => h === normalizeForMatch(k))) {
      return { colIndex, header, suggestedField: "ignore" as const };
    }

    for (const field of QUOTE_FIELD_ORDER) {
      if (usedFields.has(field)) continue;
      if (QUOTE_FIELD_KEYWORDS[field].some((k) => h.includes(normalizeForMatch(k)))) {
        usedFields.add(field);
        if (field === "unit_price" || field === "total_price") priceColumnDetected = true;
        return { colIndex, header, suggestedField: field };
      }
    }

    return { colIndex, header, suggestedField: null };
  });

  return { suggestions, priceColumnDetected };
}

export function buildQuoteFieldMap(suggestions: QuoteColumnSuggestion[]): QuoteFieldMap {
  const map: QuoteFieldMap = {};
  for (const s of suggestions) map[s.colIndex] = s.suggestedField;
  return map;
}

const NUMERIC_FIELDS = new Set<QuoteParsedField>(["quantity", "unit_price", "total_price"]);

export function applyQuoteFieldMap(
  allRawRows: string[][],
  headerRowIdx: number,
  fieldMap: QuoteFieldMap
): { rows: QuoteParsedRow[]; skippedRows: number } {
  const rows: QuoteParsedRow[] = [];
  let skippedRows = 0;

  for (let i = headerRowIdx + 1; i < allRawRows.length; i++) {
    const raw = allRawRows[i];
    if (raw.every((c) => !c.trim())) { skippedRows++; continue; }
    if (isSkipRow(raw)) { skippedRows++; continue; }

    const row: QuoteParsedRow = {
      source_row: i + 1,
      product_name: "", impa_code: "", offered_brand: "", notes: "",
      quantity: null, unit_price: null, total_price: null,
    };

    for (const [colIdxStr, field] of Object.entries(fieldMap)) {
      if (!field || field === "ignore") continue;
      const val = (raw[parseInt(colIdxStr)] ?? "").trim();
      if (!val) continue;
      if (NUMERIC_FIELDS.has(field)) {
        row[field as "quantity" | "unit_price" | "total_price"] = parseLocaleNumber(val);
      } else {
        row[field as "product_name" | "impa_code" | "offered_brand" | "notes"] = val;
      }
    }

    // Kalem eşleştirmesi için en az ürün adı veya IMPA kodu gerekir
    if (!row.product_name && !row.impa_code) { skippedRows++; continue; }
    rows.push(row);
  }

  return { rows, skippedRows };
}

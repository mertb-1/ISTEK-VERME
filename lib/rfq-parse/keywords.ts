import type { ParsedItemField, ColumnSuggestion } from "./types";

export const FIELD_KEYWORDS: Record<ParsedItemField | "price", string[]> = {
  product_name: [
    "stok aciklamasi", "urun adi", "urun", "malzeme", "product name",
    "description", "product", "item", "type & description", "type &",
    "malzemenin cinsi", "aciklama", "tanim",
  ],
  brand: ["gemi istek", "marka", "brand", "make", "manufacturer", "uretici"],
  quantity: ["miktar", "qty", "qtty", "q.ty", "quantity", "adet", "talep"],
  unit: ["birim", "unit", "uom", "olcu", "u/m", "olcu birimi"],
  impa_code: ["impa", "impa/issa", "impa code", "issa", "impa no", "issa code", "issa no"],
  description: ["not", "remark", "remarks", "notlar", "detail", "detay"],
  price: [
    "birim f", "u.price", "unit price", "amount", "total", "tutar",
    "fiyat", "toplam tutar", "iskonto", "u.fiyat", "birim fiyat",
    "on board", "onboard",
  ],
};

const TURKISH_MAP: Record<string, string> = {
  "i̇": "i", "ğ": "g", "ü": "u", "ş": "s", "ö": "o", "ç": "c",
  "İ": "i", "Ğ": "g", "Ü": "u", "Ş": "s", "Ö": "o", "Ç": "c",
};

export function normalizeForMatch(s: string): string {
  return s
    .replace(/[i̇ğüşöçİĞÜŞÖÇ]/g, (m) => TURKISH_MAP[m] ?? m)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function suggestColumns(headers: string[]): {
  suggestions: ColumnSuggestion[];
  priceDetected: boolean;
} {
  const usedFields = new Set<string>();
  let priceDetected = false;

  const suggestions: ColumnSuggestion[] = headers.map((header, colIndex) => {
    const h = normalizeForMatch(header);
    if (!h) return { colIndex, header, suggestedField: "ignore" as const };

    for (const [field, keywords] of Object.entries(FIELD_KEYWORDS) as [
      ParsedItemField | "price",
      string[],
    ][]) {
      if (keywords.some((k) => h.includes(normalizeForMatch(k)))) {
        if (field === "price") {
          priceDetected = true;
          return { colIndex, header, suggestedField: "price" as const };
        }
        if (!usedFields.has(field)) {
          usedFields.add(field);
          return { colIndex, header, suggestedField: field };
        }
      }
    }

    return { colIndex, header, suggestedField: null };
  });

  return { suggestions, priceDetected };
}

export const SKIP_ROW_KEYWORDS = [
  "toplam", "genel toplam", "iskonto", "discount",
  "grand total", "beyan", "liman", "nakliye", "expenses",
  "subtotal", "kdv", "total expenses", "amount due",
];

export function isSkipRow(cells: string[]): boolean {
  const text = normalizeForMatch(cells.join(" "));
  return SKIP_ROW_KEYWORDS.some((k) => text.includes(normalizeForMatch(k)));
}

export function applyFieldMap(
  allRawRows: string[][],
  headerRowIdx: number,
  fieldMap: Record<number, ParsedItemField | "price" | "ignore" | null>
): { items: import("./types").ParsedItem[]; skippedRows: number } {
  const dataRows = allRawRows.slice(headerRowIdx + 1);
  const items: import("./types").ParsedItem[] = [];
  let skippedRows = 0;

  for (const row of dataRows) {
    if (row.every((c) => !c.trim())) { skippedRows++; continue; }
    if (isSkipRow(row)) { skippedRows++; continue; }

    const item: import("./types").ParsedItem = {
      product_name: "", brand: "", quantity: "",
      unit: "", impa_code: "", description: "",
    };

    for (const [colIdxStr, field] of Object.entries(fieldMap)) {
      if (!field || field === "price" || field === "ignore") continue;
      const colIdx = parseInt(colIdxStr);
      const val = (row[colIdx] ?? "").trim();
      if (val) item[field as ParsedItemField] = val;
    }

    if (!item.product_name.trim()) { skippedRows++; continue; }
    items.push(item);
  }

  return { items, skippedRows };
}

export type ParsedItemField =
  | "product_name"
  | "brand"
  | "quantity"
  | "unit"
  | "impa_code"
  | "description";

export interface ParsedItem {
  product_name: string;
  brand: string;
  quantity: string;
  unit: string;
  impa_code: string;
  description: string;
}

const ALIASES: Record<ParsedItemField, string[]> = {
  product_name: [
    "ürün adı", "ürün", "malzeme", "isim", "name", "product", "açıklama", "item", "material",
    "type & description of the item", "malzemenin cinsi ve açıklaması", "description of the item",
    "type & description", "description",
  ],
  brand: ["marka", "brand", "make", "manufacturer", "üretici"],
  quantity: [
    "miktar", "adet", "qty", "quantity", "amount", "miktarı",
    "request", "i̇stek", "istek", "talep", "request qty",
  ],
  unit: [
    "birim", "unit", "ölçü", "uom", "ölçü birimi",
    "request unit", "talep birimi",
  ],
  impa_code: [
    "impa", "impa kodu", "impa code", "impa no", "impa_code",
    "issa code", "issa", "issa no", "issa kodu",
  ],
  description: [
    "açıklama", "not", "notes", "remarks", "comment", "yorum", "detay", "detail",
    "notlar",
  ],
};

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

export function matchHeaders(headers: string[]): {
  fieldMap: Record<number, ParsedItemField>;
  unmappedColumns: string[];
} {
  const fieldMap: Record<number, ParsedItemField> = {};
  const unmappedColumns: string[] = [];
  const usedFields = new Set<ParsedItemField>();

  for (let i = 0; i < headers.length; i++) {
    const h = normalize(headers[i]);
    let matched: ParsedItemField | null = null;

    for (const [field, aliases] of Object.entries(ALIASES) as [ParsedItemField, string[]][]) {
      if (!usedFields.has(field) && aliases.includes(h)) {
        matched = field;
        break;
      }
    }

    if (matched) {
      fieldMap[i] = matched;
      usedFields.add(matched);
    } else if (headers[i].trim()) {
      unmappedColumns.push(headers[i]);
    }
  }

  return { fieldMap, unmappedColumns };
}

export function rowToItem(
  row: Record<string, unknown>,
  headers: string[],
  fieldMap: Record<number, ParsedItemField>
): ParsedItem {
  const item: ParsedItem = {
    product_name: "",
    brand: "",
    quantity: "",
    unit: "",
    impa_code: "",
    description: "",
  };

  for (let i = 0; i < headers.length; i++) {
    const field = fieldMap[i];
    if (!field) continue;
    const val = String(row[headers[i]] ?? "").trim();
    item[field] = val;
  }

  return item;
}

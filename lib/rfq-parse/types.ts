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

export interface RfqMeta {
  vessel?: string;
  company?: string;
  date?: string;
  contact?: string;
}

export interface ColumnSuggestion {
  colIndex: number;
  header: string;
  suggestedField: ParsedItemField | "price" | "ignore" | null;
}

export interface ExcelApiResponse {
  meta: RfqMeta;
  headerRowIdx: number;
  headerConfidence: "high" | "low";
  columnSuggestions: ColumnSuggestion[];
  allRawRows: string[][];
  priceColumnsDetected: boolean;
  sourceFileUrl: string | null;
  warnings: string[];
}

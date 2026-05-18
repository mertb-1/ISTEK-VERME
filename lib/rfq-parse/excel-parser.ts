import * as XLSX from "xlsx";
import type { RfqMeta, ExcelApiResponse } from "./types";
import { suggestColumns, normalizeForMatch } from "./keywords";

const META_KEYWORDS: Record<keyof RfqMeta, string[]> = {
  vessel: ["gemi adi", "vessel name", "ship name", "gemi", "vessel", "m/v"],
  company: ["firma adi", "company", "customer name", "musteri", "firma", "musteri adi"],
  date: ["tarih", "date", "siparis tarihi", "order date"],
  contact: ["ilgili kisi", "yetkili", "contact", "ilgili", "sorumlu"],
};

function expandMergedCells(ws: XLSX.WorkSheet): void {
  if (!ws["!merges"]) return;
  for (const merge of ws["!merges"]) {
    const { s, e } = merge;
    const startAddr = XLSX.utils.encode_cell(s);
    const cellValue = ws[startAddr];
    if (!cellValue) continue;
    for (let r = s.r; r <= e.r; r++) {
      for (let c = s.c; c <= e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (addr !== startAddr && !ws[addr]) {
          ws[addr] = { ...cellValue };
        }
      }
    }
  }
}

export function parseExcelFile(buffer: Buffer): Omit<ExcelApiResponse, "sourceFileUrl"> {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];

  expandMergedCells(ws);

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  if (rawRows.length === 0) {
    return {
      meta: {},
      headerRowIdx: 0,
      headerConfidence: "low",
      columnSuggestions: [],
      allRawRows: [],
      priceColumnsDetected: false,
      warnings: ["Dosyada veri bulunamadı."],
    };
  }

  // Normalize all cells to trimmed strings
  const allRawRows: string[][] = rawRows.map((row) =>
    (row as unknown[]).map((c) => String(c ?? "").trim())
  );

  const warnings: string[] = [];

  // --- Extract metadata from first 20 rows ---
  const meta: RfqMeta = {};
  const topRows = allRawRows.slice(0, Math.min(20, allRawRows.length));

  for (let r = 0; r < topRows.length; r++) {
    const row = topRows[r];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell) continue;
      const cellN = normalizeForMatch(cell);

      for (const [key, keywords] of Object.entries(META_KEYWORDS) as [keyof RfqMeta, string[]][]) {
        if (meta[key]) continue;
        if (keywords.some((k) => cellN.includes(normalizeForMatch(k)))) {
          // Look right (skip cells that also look like keywords)
          const rightVal = row[c + 1]?.trim() || row[c + 2]?.trim() || "";
          const belowVal = r + 1 < topRows.length ? topRows[r + 1][c]?.trim() || "" : "";
          const val = rightVal || belowVal;
          // Don't use the value if it looks like another label
          if (
            val &&
            !Object.values(META_KEYWORDS)
              .flat()
              .some((k) => normalizeForMatch(val).includes(normalizeForMatch(k)))
          ) {
            meta[key] = val;
          }
        }
      }
    }
  }

  // --- Detect header row ---
  let headerRowIdx = -1;
  let headerConfidence: "high" | "low" = "low";

  for (let i = 0; i < Math.min(25, allRawRows.length); i++) {
    const row = allRawRows[i];
    const firstN = normalizeForMatch(row[0] ?? "");
    const isNoCell =
      firstN === "no" || firstN === "no." || firstN === "#" ||
      firstN === "sira no" || firstN === "s.no" || firstN === "sno";
    const filledCount = row.filter((c) => c.length > 0).length;

    if (isNoCell && filledCount >= 4) {
      headerRowIdx = i;
      headerConfidence = "high";
      break;
    }
  }

  // Fallback: row with most text cells in first 20 rows
  if (headerRowIdx === -1) {
    let bestScore = 0;
    for (let i = 0; i < Math.min(20, allRawRows.length); i++) {
      const score = allRawRows[i].filter(
        (c) => c.length > 1 && !/^\d+([.,]\d+)?$/.test(c)
      ).length;
      if (score > bestScore) { bestScore = score; headerRowIdx = i; }
      if (score >= 5) break;
    }
    if (bestScore < 2) {
      warnings.push("Tablo başlığı tespit edilemedi. Adım 2'de başlık satırını seçin.");
    }
  }

  if (headerRowIdx < 0) headerRowIdx = 0;

  const rawHeaders = allRawRows[headerRowIdx] ?? [];
  const { suggestions: columnSuggestions, priceDetected: priceColumnsDetected } =
    suggestColumns(rawHeaders);

  console.log("[excel-parser] headerRowIdx:", headerRowIdx, "confidence:", headerConfidence);
  console.log("[excel-parser] headers:", rawHeaders);
  console.log("[excel-parser] meta:", meta);

  return {
    meta,
    headerRowIdx,
    headerConfidence,
    columnSuggestions,
    allRawRows,
    priceColumnsDetected,
    warnings,
  };
}

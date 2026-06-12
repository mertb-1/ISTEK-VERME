import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseExcelFile } from "@/lib/rfq-parse/excel-parser";
import {
  suggestQuoteColumns,
  buildQuoteFieldMap,
  applyQuoteFieldMap,
} from "@/lib/rfq-parse/quote-import";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTS = [".xlsx", ".xls", ".csv"];

function ext(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

/**
 * Cevaplanmış tedarikçi teklif dosyasını parse eder — Phase 2.
 *
 * Yalnızca önizleme döner: quote/quote_items YAZILMAZ. Insert işlemi
 * sonraki fazda /api/quote/import üzerinden yapılacak.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  }

  const fileExt = ext(file.name);
  if (!ALLOWED_EXTS.includes(fileExt)) {
    return NextResponse.json(
      { error: "Sadece .xlsx, .xls ve .csv dosyaları kabul edilir." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya boyutu 10 MB'yi geçemez." }, { status: 400 });
  }

  // Orijinal dosyayı denetim için private bucket'a yükle
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadErr } = await admin.storage
    .from("quote-source-files")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  const sourceFileUrl = uploadErr ? null : storagePath;

  const parsed = parseExcelFile(buffer);
  const warnings = [...parsed.warnings];

  // RFQ alan önerileri yerine quote alan önerileri (fiyat birinci sınıf)
  const rawHeaders = parsed.allRawRows[parsed.headerRowIdx] ?? [];
  const { suggestions: columnSuggestions, priceColumnDetected } =
    suggestQuoteColumns(rawHeaders);

  if (!priceColumnDetected) {
    warnings.push("Fiyat sütunu tespit edilemedi. Sütun eşleştirme adımında elle seçin.");
  }

  // Önerilen map ile önizleme satırları üret
  const { rows: previewRows, skippedRows } = applyQuoteFieldMap(
    parsed.allRawRows,
    parsed.headerRowIdx,
    buildQuoteFieldMap(columnSuggestions)
  );

  if (previewRows.length === 0) {
    warnings.push("Dosyada teklif kalemi bulunamadı. Başlık satırını ve sütunları kontrol edin.");
  }

  return NextResponse.json({
    meta: parsed.meta,
    headerRowIdx: parsed.headerRowIdx,
    headerConfidence: parsed.headerConfidence,
    allRawRows: parsed.allRawRows,
    columnSuggestions,
    priceColumnDetected,
    previewRows,
    skippedRows,
    sourceFileUrl,
    warnings,
  });
}

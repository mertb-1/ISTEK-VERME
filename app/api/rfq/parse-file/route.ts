import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { matchHeaders, rowToItem, ParsedItem } from "@/lib/rfq-parse/header-map";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTS = [".xlsx", ".xls", ".pdf"];

function ext(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function parseExcel(buffer: Buffer): {
  items: ParsedItem[];
  unmappedColumns: string[];
  warnings: string[];
} {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  if (rows.length === 0) {
    return { items: [], unmappedColumns: [], warnings: ["Dosyada veri bulunamadı."] };
  }

  const headers = Object.keys(rows[0]);
  const { fieldMap, unmappedColumns } = matchHeaders(headers);

  const items: ParsedItem[] = [];
  for (const row of rows) {
    const item = rowToItem(row, headers, fieldMap);
    if (!item.product_name.trim()) continue; // boş satırı atla
    items.push(item);
  }

  return { items, unmappedColumns, warnings: [] };
}

async function parsePdf(buffer: Buffer): Promise<{
  items: ParsedItem[];
  unmappedColumns: string[];
  warnings: string[];
}> {
  let pdfParse: (buf: Buffer) => Promise<{ text: string }>;
  try {
    // dynamic import — server-only
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("pdf-parse");
    pdfParse = mod.default ?? mod;
  } catch {
    return {
      items: [],
      unmappedColumns: [],
      warnings: ["PDF işleme modülü yüklenemedi. Lütfen Excel formatını kullanın."],
    };
  }

  const data = await pdfParse(buffer);
  const text = data.text;

  if (!text || text.trim().length < 10) {
    return {
      items: [],
      unmappedColumns: [],
      warnings: [
        "Bu PDF taranmış görünüyor, metin çıkarılamadı. Manuel ekleme yapın veya Excel şablonunu kullanın.",
      ],
    };
  }

  // Satırları al, boşlukları normalize et
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { items: [], unmappedColumns: [], warnings: ["PDF'te tablo verisi bulunamadı."] };
  }

  // İlk satırı header olarak kabul et, sütunları 2+ boşlukla ayır
  const splitLine = (line: string) =>
    line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);

  const headers = splitLine(lines[0]);
  if (headers.length < 2) {
    return {
      items: [],
      unmappedColumns: [],
      warnings: [
        "PDF tablo yapısı tanınamadı. Lütfen Excel şablonunu kullanın.",
      ],
    };
  }

  const { fieldMap, unmappedColumns } = matchHeaders(headers);

  const items: ParsedItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length === 0) continue;
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] ?? "";
    });
    const item = rowToItem(row, headers, fieldMap);
    if (!item.product_name.trim()) continue;
    items.push(item);
  }

  return { items, unmappedColumns, warnings: [] };
}

export async function POST(req: NextRequest) {
  // Auth kontrolü
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

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

  // Tip kontrolü
  const fileExt = ext(file.name);
  if (!ALLOWED_EXTS.includes(fileExt)) {
    return NextResponse.json(
      { error: "Sadece .xlsx, .xls veya .pdf dosyaları kabul edilir." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Boyut kontrolü
  if (buffer.length > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya boyutu 10 MB'yi geçemez." }, { status: 400 });
  }

  // Supabase Storage'a yükle
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error: uploadErr } = await admin.storage
    .from("rfq-source-files")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  const sourceFileUrl = uploadErr ? null : storagePath;

  // Parse
  const isPdf = fileExt === ".pdf";
  const sourceType = isPdf ? "pdf" : "excel";

  const result = isPdf
    ? await parsePdf(buffer)
    : parseExcel(buffer);

  return NextResponse.json({
    items: result.items,
    unmappedColumns: result.unmappedColumns,
    sourceFileUrl,
    sourceType,
    warnings: result.warnings,
  });
}

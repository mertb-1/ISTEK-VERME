import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import * as pdfParseModule from "pdf-parse";
type PdfParseResult = { text: string };
type PdfParseFn = (buffer: Buffer, options?: { max?: number }) => Promise<PdfParseResult>;
const pdfParse = ((pdfParseModule as { default?: PdfParseFn }).default ?? pdfParseModule) as PdfParseFn;

export interface PdfProduct {
  row_number: number;
  product_name: string;
  brand: string | null;
  quantity: number | null;
  unit: string | null;
  impa_code: string | null;
  notes: string | null;
}

export interface PdfParsedData {
  vessel_name: string | null;
  company_name: string | null;
  date: string | null;
  contact_person: string | null;
  products: PdfProduct[];
}

export interface PdfApiResponse {
  data: PdfParsedData;
}

const SYSTEM_PROMPT = `Sen bir denizcilik sektörü tedarik listesi parser'ısın.
Sana bir gemi tedarik listesinin metin içeriği verilecek.
Şunları çıkar ve SADECE JSON formatında döndür, başka hiçbir şey yazma, markdown kullanma:

{
  "vessel_name": "gemi adı veya null",
  "company_name": "firma adı veya null",
  "date": "tarih veya null",
  "contact_person": "ilgili kişi veya null",
  "products": [
    {
      "row_number": 1,
      "product_name": "ürün adı",
      "brand": "marka veya null",
      "quantity": sayısal değer veya null,
      "unit": "birim veya null",
      "impa_code": "IMPA kodu veya null",
      "notes": "not veya null"
    }
  ]
}

ÖNEMLİ KURALLAR:
- Fiyat bilgilerini (birim fiyat, toplam tutar) ALMA
- Toplam/iskonto/genel toplam satırlarını ürün listesine EKLEME
- Logo, adres, telefon bilgilerini ALMA
- Boş satırları ALMA
- Sadece ürün olan satırları al
- Emin olmadığın alanlar için null kullan
- SADECE JSON döndür, başka hiçbir şey yazma

ÇOKLU MİKTAR KOLONLARI — ÇOK ÖNEMLİ:
Bu PDF formlarında her satırda iki ayrı sayı yan yana gelir:
  [ON BOARD/MEVCUT sayısı]  [REQUEST/İSTEK sayısı]

Örneğin metin içeriğinde "1 1" görürsün: birinci 1 = mevcut, ikinci 1 = istek.
"2 3" görürsün: 2 = mevcut, 3 = istek.
"0 5" görürsün: 0 = mevcut, 5 = istek.

KURAL: quantity alanına SADECE ikinci sayıyı (REQUEST/İSTEK) yaz.
- "1 1" → quantity: 1
- "2 3" → quantity: 3
- "0 5" → quantity: 5
- "11" gibi bitişik gelirse → tek haneli ise 1, iki haneli ise yanlış parse, null yaz

İki sayıyı birleştirme ("1"+"1"="11" yapma), toplama, çarpma — HİÇBİR işlem yapma.
Sadece ikinci sayıyı al.`;

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "İstek okunamadı." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  }

  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Sadece PDF dosyaları kabul edilir." },
      { status: 400 }
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Dosya 10 MB'den büyük olamaz." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Extract text from PDF
  let extractedText: string;
  try {
    const result = await pdfParse(buffer, { max: 3 }); // max 3 pages
    extractedText = result.text ?? "";
    console.log("[parse-pdf] extracted text (first 1000 chars):", extractedText.slice(0, 1000));
  } catch {
    return NextResponse.json(
      {
        error:
          "PDF okunamadı. Şifreli veya bozuk olabilir. Lütfen açık bir PDF yükleyin.",
      },
      { status: 400 }
    );
  }

  const cleanedText = extractedText.trim();

  if (cleanedText.length < 50) {
    return NextResponse.json(
      {
        error:
          "Bu PDF taranmış (görsel) görünüyor ve metin içermiyor. Lütfen Word/Excel'den oluşturulmuş bir PDF veya Excel dosyası yükleyin.",
        scanned: true,
      },
      { status: 422 }
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let content: string;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Aşağıdaki PDF metin içeriğini analiz et ve JSON formatında döndür:\n\n${cleanedText}`,
        },
      ],
    });
    content = response.choices[0]?.message?.content ?? "";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
      return NextResponse.json(
        {
          error:
            "İşlem zaman aşımına uğradı. PDF çok büyük olabilir, daha kısa bir liste deneyin.",
        },
        { status: 504 }
      );
    }
    return NextResponse.json(
      { error: "Yapay zeka servisi geçici olarak kullanılamıyor." },
      { status: 503 }
    );
  }

  // Clean markdown fences if present
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: PdfParsedData;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return NextResponse.json(
      {
        error:
          "Yapay zeka yanıtı işlenemedi. Tekrar deneyin veya farklı bir PDF yükleyin.",
      },
      { status: 500 }
    );
  }

  if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
    return NextResponse.json(
      {
        error:
          "PDF'de ürün listesi bulunamadı. Manuel olarak ürün ekleyin.",
        empty: true,
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ data: parsed } satisfies PdfApiResponse);
}

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

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

// ─── Request body: frontend gönderir ─────────────────────────────────────────
// text tabanlı PDF  → { text: string }
// taranmış PDF      → { images: string[] }  (base64 JPEG, max 3 sayfa)
interface ParsePdfBody {
  text?: string;
  images?: string[];
}

// ─── System prompt ────────────────────────────────────────────────────────────

const JSON_SCHEMA = `{
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
}`;

const SHARED_RULES = `
KRİTİK KURALLAR:
1. SADECE belgede gördüğün ürünleri yaz
2. Hiçbir zaman tahmin etme veya uydurma
3. Emin olmadığında products: [] döndür
4. Belgede görmediğin hiçbir ürün ekleme

DIŞARIDA BIRAK:
- Fiyat bilgileri (birim fiyat, toplam tutar)
- Toplam / iskonto / genel toplam satırları
- Logo, adres, telefon, e-posta bilgileri
- Boş satırlar ve başlık satırları

MİKTAR KURALI — ÇOK ÖNEMLİ:
Bu formlarda her satırda iki ayrı sayı olabilir:
  [ON BOARD / MEVCUT]  [REQUEST / İSTEK]

SADECE REQUEST / İSTEK kolonundaki miktarı al. ON BOARD / MEVCUT'u tamamen yoksay.

Örnekler (ON BOARD → REQUEST → doğru quantity):
  2 → 2 → quantity: 2    (sayıları birleştirme, "22" yapma)
  0 → 3 → quantity: 3
  1 → 1 → quantity: 1    ("11" yapma, sadece 1)
  5 → 0 → quantity: 0

Eğer satır sonunda "X Y" formatında iki sayı varsa: ikincisi REQUEST'tir.
İki sayıyı asla birleştirme, toplama veya çarpma.

ÇIKTI:
SADECE JSON döndür. Markdown, açıklama, ek metin yazma.`;

const TEXT_SYSTEM_PROMPT = `Sen bir denizcilik sektörü tedarik listesi parser'ısın.
Sana bir gemi tedarik listesinin ham metin içeriği verilecek.
Şunları çıkar ve SADECE şu JSON şemasında döndür, başka hiçbir şey yazma:

${JSON_SCHEMA}
${SHARED_RULES}`;

const IMAGE_SYSTEM_PROMPT = `Sen bir denizcilik sektörü tedarik listesi parser'ısın.
Sana bir gemi tedarik listesi PDF'inin sayfa görüntüleri verilecek.
Görüntülerdeki tabloyu analiz et ve SADECE şu JSON şemasında döndür, başka hiçbir şey yazma:

${JSON_SCHEMA}
${SHARED_RULES}`;

// ─── ON BOARD / REQUEST pre-processor ────────────────────────────────────────
// Metin tabanlı PDF'lerde her satır sonda iki sayı içerebilir: [on_board] [request]
// Bu fonksiyon bu sayıları tespit edip sadece REQUEST'i bırakır.
function preprocessTextQuantities(text: string): string {
  const hasOnBoard =
    /on\s*board|mevcut/i.test(text);
  const hasRequest =
    /\brequest\b|i[sş]tek/i.test(text);

  if (!hasOnBoard || !hasRequest) return text;

  const lines = text.split("\n");
  return lines
    .map((line) => {
      // Satır sonu: boşlukla ayrılmış tam olarak iki sayı → ikincisini al
      const m = line.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s+(\d+(?:[.,]\d+)?)\s*$/);
      if (m) {
        // m[2] = ON BOARD, m[3] = REQUEST
        return `${m[1]} ${m[3]}`;
      }
      return line;
    })
    .join("\n");
}

// ─── JSON cleaner ─────────────────────────────────────────────────────────────
function cleanJson(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  let body: ParsePdfBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { text, images } = body;

  if (!text && (!images || images.length === 0)) {
    return NextResponse.json(
      { error: "text veya images alanı gerekli." },
      { status: 400 }
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let content: string;

  // ── AKIŞ 1: Metin tabanlı PDF ──────────────────────────────────────────────
  if (text) {
    const processedText = preprocessTextQuantities(text.trim());
    console.log("[parse-pdf:text] ilk 800 char:", processedText.slice(0, 800));

    if (processedText.length < 50) {
      return NextResponse.json(
        {
          error:
            "PDF'den yeterli metin çıkarılamadı. Taranmış PDF ise görüntü akışına geçilmeli.",
          scanned: true,
        },
        { status: 422 }
      );
    }

    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 4000,
        messages: [
          { role: "system", content: TEXT_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Aşağıdaki gemi tedarik listesi metnini analiz et:\n\n${processedText}`,
          },
        ],
      });
      content = res.choices[0]?.message?.content ?? "";
    } catch (err: unknown) {
      return NextResponse.json(
        { error: gptErrorMessage(err) },
        { status: 503 }
      );
    }
  }
  // ── AKIŞ 2: Taranmış PDF (görüntüler) ─────────────────────────────────────
  else {
    const safeImages = (images as string[]).slice(0, 3);
    console.log("[parse-pdf:images] sayfa sayısı:", safeImages.length);

    try {
      const res = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 4000,
        messages: [
          { role: "system", content: IMAGE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Bu gemi tedarik listesi PDF sayfalarını analiz et ve JSON formatında döndür.",
              },
              ...safeImages.map((b64) => ({
                type: "image_url" as const,
                image_url: {
                  url: `data:image/jpeg;base64,${b64}`,
                  detail: "high" as const,
                },
              })),
            ],
          },
        ],
      });
      content = res.choices[0]?.message?.content ?? "";
    } catch (err: unknown) {
      return NextResponse.json(
        { error: gptErrorMessage(err) },
        { status: 503 }
      );
    }
  }

  // ── JSON parse ─────────────────────────────────────────────────────────────
  let parsed: PdfParsedData;
  try {
    parsed = JSON.parse(cleanJson(content));
  } catch {
    console.error("[parse-pdf] JSON parse hatası, ham yanıt:", content.slice(0, 300));
    return NextResponse.json(
      { error: "Yapay zeka yanıtı işlenemedi. Tekrar deneyin." },
      { status: 500 }
    );
  }

  if (!Array.isArray(parsed.products) || parsed.products.length === 0) {
    return NextResponse.json(
      { error: "Ürün listesi bulunamadı. Manuel olarak ürün ekleyin.", empty: true },
      { status: 422 }
    );
  }

  return NextResponse.json({ data: parsed } satisfies PdfApiResponse);
}

function gptErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("timeout") || msg.includes("ETIMEDOUT")) {
    return "İşlem zaman aşımına uğradı. Daha kısa bir liste deneyin.";
  }
  return "Yapay zeka servisi geçici olarak kullanılamıyor.";
}

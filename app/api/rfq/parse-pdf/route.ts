import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { pdf } from "pdf-to-img";

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

const SYSTEM_PROMPT = `Sen bir denizcilik sektörü PDF parser'ısın.
Sana bir gemi tedarik listesi PDF'i verilecek.
Şunları çıkar ve SADECE JSON formatında döndür,
başka hiçbir şey yazma, markdown kullanma:

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
- SADECE JSON döndür, başka hiçbir şey yazma`;

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

  // PDF → PNG images (max 3 pages)
  const base64Images: string[] = [];
  try {
    const document = await pdf(buffer, { scale: 1.5 });
    let pageCount = 0;
    for await (const page of document) {
      if (pageCount >= 3) break;
      base64Images.push((page as Buffer).toString("base64"));
      pageCount++;
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "PDF okunamadı. Şifreli veya bozuk olabilir. Lütfen açık bir PDF yükleyin.",
      },
      { status: 400 }
    );
  }

  if (base64Images.length === 0) {
    return NextResponse.json(
      { error: "PDF'den sayfa alınamadı." },
      { status: 400 }
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
          content: [
            {
              type: "text",
              text: "Bu PDF sayfasındaki gemi tedarik listesini analiz et ve JSON formatında döndür.",
            },
            ...base64Images.map((b64) => ({
              type: "image_url" as const,
              image_url: {
                url: `data:image/png;base64,${b64}`,
                detail: "high" as const,
              },
            })),
          ],
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

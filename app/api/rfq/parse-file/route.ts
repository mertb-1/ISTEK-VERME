import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseExcelFile } from "@/lib/rfq-parse/excel-parser";

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTS = [".xlsx", ".xls"];

function ext(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
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
      { error: "Sadece .xlsx ve .xls dosyaları kabul edilir." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_SIZE) {
    return NextResponse.json({ error: "Dosya boyutu 10 MB'yi geçemez." }, { status: 400 });
  }

  // Upload to Supabase Storage
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

  const result = parseExcelFile(buffer);

  return NextResponse.json({ ...result, sourceFileUrl });
}

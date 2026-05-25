import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MailTemplateType } from "@/lib/mail-defaults";
import type { Align } from "@/lib/mail";

const VALID_ALIGNS: Align[] = ["left", "center", "right"];

const VALID_TYPES: MailTemplateType[] = [
  "supplier_rfq",
  "buyer_notification",
  "approval",
  "supplier_order_notification",
  "supplier_order_cancelled",
];

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .single();
  return data ? user : null;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("mail_templates")
    .select("id, type, subject, greeting, greeting_align, body, body_align, signature, signature_align, is_active, updated_at")
    .order("type");

  if (error) {
    console.error("mail_templates GET error:", error.code);
    return NextResponse.json({ error: "Veriler alınamadı." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const {
    type,
    subject,
    greeting,
    body: mailBody,
    signature,
    greeting_align,
    body_align,
    signature_align,
  } = body;

  if (!VALID_TYPES.includes(type as MailTemplateType)) {
    return NextResponse.json({ error: "Geçersiz şablon tipi." }, { status: 400 });
  }
  if (
    typeof subject !== "string" ||
    typeof greeting !== "string" ||
    typeof mailBody !== "string" ||
    typeof signature !== "string"
  ) {
    return NextResponse.json({ error: "Eksik alanlar." }, { status: 400 });
  }

  const safeGreetingAlign: Align = VALID_ALIGNS.includes(greeting_align as Align)
    ? (greeting_align as Align)
    : "left";
  const safeBodyAlign: Align = VALID_ALIGNS.includes(body_align as Align)
    ? (body_align as Align)
    : "left";
  const safeSignatureAlign: Align = VALID_ALIGNS.includes(signature_align as Align)
    ? (signature_align as Align)
    : "left";

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("mail_templates")
    .update({
      subject: subject.slice(0, 500),
      greeting: greeting.slice(0, 500),
      greeting_align: safeGreetingAlign,
      body: mailBody.slice(0, 5000),
      body_align: safeBodyAlign,
      signature: signature.slice(0, 1000),
      signature_align: safeSignatureAlign,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    })
    .eq("type", type);

  if (error) {
    console.error("mail_templates PATCH error:", error.code);
    return NextResponse.json({ error: "Güncelleme başarısız." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

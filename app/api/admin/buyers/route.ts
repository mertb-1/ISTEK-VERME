import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMailTemplate, replaceVars, buildMailHtml, sendSimpleMail } from "@/lib/mail";
import { APP_NAME } from "@/lib/config";

// UUID format kontrolü
function isUuid(val: unknown): val is string {
  return (
    typeof val === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
  );
}

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("buyers")
    .select("id, email, full_name, company_name, phone, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("buyers GET error:", error.code);
    return NextResponse.json({ error: "Veriler alınamadı." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const { id, status } = body;

  if (!isUuid(id)) {
    return NextResponse.json({ error: "Geçersiz kimlik." }, { status: 400 });
  }

  if (!["approved", "rejected", "pending"].includes(status as string)) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("buyers")
    .update({ status })
    .eq("id", id);

  if (error) {
    console.error("buyer PATCH error:", error.code);
    return NextResponse.json({ error: "Güncelleme başarısız." }, { status: 500 });
  }

  // Onaylandıysa alıcıya bildirim maili gönder
  if (status === "approved") {
    try {
      const { data: buyer } = await adminClient
        .from("buyers")
        .select("email, full_name, company_name")
        .eq("id", id)
        .single();

      if (buyer?.email) {
        const template = await getMailTemplate("approval");
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const vars: Record<string, string> = {
          alici_adi: buyer.full_name ?? "",
          firma_adi: buyer.company_name ?? APP_NAME,
          giris_linki: `${appUrl}/login`,
        };
        const subject = template ? replaceVars(template.subject, vars) : `Hesabınız Onaylandı - ${vars.firma_adi}`;
        const greeting = template ? replaceVars(template.greeting, vars) : `Sayın ${vars.alici_adi},`;
        const bodyText = template ? replaceVars(template.body, vars) : `${vars.firma_adi} teklif platformuna üyeliğiniz onaylandı.`;
        const signature = template ? replaceVars(template.signature, vars) : APP_NAME;

        const html = buildMailHtml({
          greeting,
          body: bodyText,
          signature,
          companyName: buyer.company_name ?? APP_NAME,
          type: "approval",
          actionUrl: `${appUrl}/login`,
          appName: APP_NAME,
        });

        await sendSimpleMail({ to: buyer.email, subject, html, fromName: APP_NAME });
      }
    } catch (mailErr) {
      console.error("approval mail error:", mailErr);
    }
  }

  return NextResponse.json({ success: true });
}

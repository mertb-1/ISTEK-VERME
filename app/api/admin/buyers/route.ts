import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ role: null });

  const admin = createAdminClient();

  const { data: isAdmin } = await admin
    .from("admins")
    .select("id")
    .eq("id", user.id)
    .single();

  if (isAdmin) return NextResponse.json({ role: "admin" });

  const { data: buyer } = await admin
    .from("buyers")
    .select("status")
    .eq("id", user.id)
    .single();

  if (!buyer) return NextResponse.json({ role: "unknown" });
  return NextResponse.json({ role: "buyer", status: buyer.status });
}

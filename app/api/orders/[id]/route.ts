import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

function isUuid(val: unknown): val is string {
  return typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  confirmed:            ["completed", "cancelled"],
  pending_confirmation: ["cancelled"],
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const newStatus: string = body?.status;
  if (!newStatus) return NextResponse.json({ error: "missing_status" }, { status: 400 });

  // Fetch with buyer_id check (RLS + explicit filter)
  const { data: order } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", params.id)
    .eq("buyer_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json({ error: "invalid_transition" }, { status: 422 });
  }

  const update: Record<string, string> = { status: newStatus };
  if (newStatus === "completed") update.completed_at = new Date().toISOString();
  if (newStatus === "cancelled") update.cancelled_at = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update(update)
    .eq("id", params.id)
    .eq("buyer_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

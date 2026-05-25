import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getMailTemplate, replaceVars, buildMailHtml, sendSimpleMail, esc } from "@/lib/mail";
import { MAIL_DEFAULTS } from "@/lib/mail-defaults";
import { APP_NAME } from "@/lib/config";

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

  const cancellationReason: string =
    typeof body?.cancellation_reason === "string"
      ? body.cancellation_reason.slice(0, 2000).trim()
      : "";

  // Fetch with buyer_id check (RLS + explicit filter)
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, rfq_id, rfq_recipient_id, confirmed_amount, currency")
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

  if (newStatus === "cancelled") {
    try {
      const admin = createAdminClient();

      const [{ data: rfq }, { data: recipient }, { data: buyer }] = await Promise.all([
        admin.from("rfqs").select("title").eq("id", order.rfq_id).single(),
        admin
          .from("rfq_recipients")
          .select("suppliers(company_name, contact_name, email)")
          .eq("id", order.rfq_recipient_id)
          .single(),
        admin.from("buyers").select("company_name, company_email, company_phone").eq("id", user.id).single(),
      ]);

      const supplierRaw = recipient?.suppliers;
      const supplier = supplierRaw
        ? (Array.isArray(supplierRaw) ? supplierRaw[0] : supplierRaw) as {
            company_name: string;
            contact_name: string;
            email: string;
          }
        : null;

      if (supplier?.email) {
        const template = await getMailTemplate("supplier_order_cancelled");
        const defaults = MAIL_DEFAULTS.supplier_order_cancelled;

        const buyerCompany = buyer?.company_name ?? APP_NAME;
        const orderCode = `SPR-${params.id.slice(0, 8).toUpperCase()}`;
        const amountStr = order.confirmed_amount != null
          ? Number(order.confirmed_amount).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "—";
        const currency = order.currency ?? "USD";
        const reasonText = cancellationReason
          ? `İptal Nedeni: ${cancellationReason}`
          : "";

        const vars: Record<string, string> = {
          alici_firma: buyerCompany,
          tedarikci_adi: supplier.contact_name || supplier.company_name,
          rfq_basligi: rfq?.title ?? "",
          siparis_kodu: orderCode,
          siparis_tutari: amountStr,
          para_birimi: currency,
          iptal_nedeni: reasonText,
          firma_telefon: buyer?.company_phone ?? "",
          firma_mail: buyer?.company_email ?? "",
        };

        const subject = replaceVars(template?.subject ?? defaults.subject, vars);
        const greeting = replaceVars(template?.greeting ?? defaults.greeting, vars);
        const mailBody = replaceVars(template?.body ?? defaults.body, vars);
        const signature = replaceVars(template?.signature ?? defaults.signature, vars);

        const html = buildMailHtml({
          greeting,
          greetingAlign: (template as { greeting_align?: string } | null)?.greeting_align as "left" | "center" | "right" | undefined ?? "left",
          body: mailBody,
          bodyAlign: (template as { body_align?: string } | null)?.body_align as "left" | "center" | "right" | undefined ?? "left",
          signature,
          signatureAlign: (template as { signature_align?: string } | null)?.signature_align as "left" | "center" | "right" | undefined ?? "left",
          logoUrl: null,
          companyName: buyerCompany,
          type: "supplier_order_cancelled",
          actionUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://teklif-platformu.vercel.app",
          appName: APP_NAME,
        });

        await sendSimpleMail({
          to: supplier.email,
          subject,
          html,
          fromName: `${esc(buyerCompany)} via ${APP_NAME}`,
          replyTo: buyer?.company_email ?? undefined,
        });
      }
    } catch (mailErr) {
      console.error("supplier_order_cancelled mail error:", mailErr);
    }
  }

  return NextResponse.json({ ok: true });
}

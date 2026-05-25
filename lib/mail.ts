import { Resend } from "resend";
import { APP_NAME } from "@/lib/config";
import type { MailTemplateType } from "@/lib/mail-defaults";

export type Align = "left" | "center" | "right";

type RfqItem = {
  product_name: string;
  brand?: string;
  quantity: number;
  unit: string;
  impa_code?: string | null;
  detailed_description?: string | null;
  photo_urls?: string[] | null;
};

type SendRfqMailParams = {
  to: string;
  supplierName: string;
  buyerCompany: string;
  rfqTitle: string;
  deadline?: string;
  rfqNotes?: string;
  items: RfqItem[];
  magicLink: string;
  buyerLogoUrl?: string | null;
  replyTo?: string;
};

// HTML injection'ı önlemek için tüm user-supplied değerleri escape et
export function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// Şablon değişkenlerini gerçek değerlerle değiştir
export function replaceVars(
  template: string,
  vars: Record<string, string>
): string {
  return Object.entries(vars).reduce(
    (text, [key, val]) =>
      text.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val ?? ""),
    template
  );
}

// Veritabanından aktif mail şablonunu çek
export async function getMailTemplate(type: MailTemplateType) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("mail_templates")
    .select("subject, greeting, greeting_align, body, body_align, signature, signature_align")
    .eq("type", type)
    .eq("is_active", true)
    .single();
  return data as (typeof data & {
    greeting_align?: Align;
    body_align?: Align;
    signature_align?: Align;
  }) | null;
}

type BuildMailHtmlParams = {
  greeting: string;
  greetingAlign?: Align;
  body: string;
  bodyAlign?: Align;
  signature: string;
  signatureAlign?: Align;
  logoUrl?: string | null;
  companyName: string;
  type: MailTemplateType;
  actionUrl: string;
  appName: string;
};

export function buildMailHtml({
  greeting,
  greetingAlign = "left",
  body,
  bodyAlign = "left",
  signature,
  signatureAlign = "left",
  logoUrl,
  companyName,
  type,
  actionUrl,
  appName,
}: BuildMailHtmlParams): string {
  const safeActionUrl = encodeURI(actionUrl);

  const headerSection = logoUrl
    ? `<img src="${esc(logoUrl)}" height="60" alt="${esc(companyName)}" style="margin-bottom:8px;max-width:200px;object-fit:contain">`
    : `<div style="font-size:24px;font-weight:700;color:#ffffff;margin-bottom:4px">${esc(companyName)}</div>`;

  let buttonLabel = "Teklif Ver &rarr;";
  if (type === "buyer_notification") buttonLabel = "Teklifleri Karşılaştır &rarr;";
  if (type === "approval") buttonLabel = "Giriş Yap &rarr;";
  if (type === "supplier_order_notification") buttonLabel = "Siparişi Görüntüle &rarr;";
  if (type === "supplier_order_cancelled") buttonLabel = "Platforma Git &rarr;";

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">
    <div style="background:#1e40af;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center">
      ${headerSection}
      <div style="color:#bfdbfe;font-size:12px;font-weight:500;letter-spacing:0.05em">via ${esc(appName.toUpperCase())}</div>
    </div>
    <div style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
      <p style="white-space:pre-line;margin:0 0 16px;font-size:15px;color:#0f172a;text-align:${greetingAlign}">${esc(greeting)}</p>
      <p style="white-space:pre-line;margin:0 0 24px;font-size:15px;color:#475569;text-align:${bodyAlign}">${esc(body)}</p>
      <div style="text-align:center;margin:32px 0">
        <a href="${safeActionUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;font-size:16px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none">
          ${buttonLabel}
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
      <p style="color:#6b7280;font-size:14px;white-space:pre-line;margin:0;text-align:${signatureAlign}">${esc(signature)}</p>
    </div>
    <div style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 32px;border:1px solid #e2e8f0;border-top:none;text-align:center">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        ${esc(companyName)} &middot; ${esc(appName)}<br>
        Bu mail otomatik gönderilmiştir.
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function sendRfqMail(params: SendRfqMailParams) {
  const {
    to,
    supplierName,
    buyerCompany,
    rfqTitle,
    deadline,
    rfqNotes,
    magicLink,
    buyerLogoUrl,
    replyTo,
  } = params;

  const deadlineText = deadline
    ? new Date(deadline).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Belirtilmemiş";

  const rfqDate = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Şablonu veritabanından çek; yoksa fallback sabit değerler
  const template = await getMailTemplate("supplier_rfq");

  const vars: Record<string, string> = {
    gemi_adi: rfqTitle,
    teklif_tarihi: rfqDate,
    firma_adi: buyerCompany,
    yetkili_adi: supplierName,
    son_tarih: deadlineText,
    teklif_notu: rfqNotes || "",
    teklif_no: "",
    firma_telefon: "",
    firma_mail: replyTo || "",
  };

  const subject = template
    ? replaceVars(template.subject, vars)
    : `Teklif Talebi: ${rfqTitle} — ${buyerCompany}`;

  const greeting = template
    ? replaceVars(template.greeting, vars)
    : `Sayın ${supplierName},`;

  const body = template
    ? replaceVars(template.body, vars)
    : `${buyerCompany} firması sizden teklif talep ediyor.\n\nSon tarih: ${deadlineText}${rfqNotes ? "\n\nNot: " + rfqNotes : ""}`;

  const signature = template
    ? replaceVars(template.signature, vars)
    : buyerCompany;

  const html = buildMailHtml({
    greeting,
    greetingAlign: template?.greeting_align ?? "left",
    body,
    bodyAlign: template?.body_align ?? "left",
    signature,
    signatureAlign: template?.signature_align ?? "left",
    logoUrl: buyerLogoUrl,
    companyName: buyerCompany,
    type: "supplier_rfq",
    actionUrl: magicLink,
    appName: APP_NAME,
  });

  const resend = new Resend(process.env.RESEND_API_KEY);

  return resend.emails.send({
    from: `${buyerCompany} via ${APP_NAME} <onboarding@resend.dev>`,
    to,
    replyTo: replyTo || undefined,
    subject,
    html,
  });
}

type SendSimpleMailParams = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  fromName?: string;
};

export async function sendSimpleMail(params: SendSimpleMailParams) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  return resend.emails.send({
    from: `${params.fromName ?? APP_NAME} <onboarding@resend.dev>`,
    to: params.to,
    replyTo: params.replyTo,
    subject: params.subject,
    html: params.html,
  });
}

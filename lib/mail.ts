import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type RfqItem = {
  product_name: string;
  brand?: string;
  quantity: number;
  unit: string;
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
};

// HTML injection'ı önlemek için tüm user-supplied değerleri escape et
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function sendRfqMail(params: SendRfqMailParams) {
  const { to, supplierName, buyerCompany, rfqTitle, deadline, rfqNotes, items, magicLink } = params;

  const deadlineText = deadline
    ? new Date(deadline).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const itemsHtml = items
    .map(
      (item, i) => `
      <tr style="background:${i % 2 === 0 ? "#f8fafc" : "#ffffff"}">
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1e293b">${esc(item.product_name)}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b">${esc(item.brand || "—")}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#64748b;text-align:right">${esc(String(item.quantity))} ${esc(item.unit)}</td>
      </tr>`
    )
    .join("");

  // magicLink sadece bizim ürettiğimiz bir UUID path — yine de encode et
  const safeLink = encodeURI(magicLink);

  const html = `
<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px">

    <!-- Header -->
    <div style="background:#1e40af;border-radius:16px 16px 0 0;padding:28px 32px;text-align:center">
      <div style="font-size:28px;margin-bottom:8px">&#9875;</div>
      <div style="color:#bfdbfe;font-size:13px;font-weight:500;letter-spacing:0.05em">TEKLİFHUB</div>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0">
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a">Yeni Teklif Talebi</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#475569">
        Sayın <strong>${esc(supplierName)}</strong>,<br>
        <strong>${esc(buyerCompany)}</strong> firması aşağıdaki ürünler için teklif talep ediyor.
      </p>

      <!-- RFQ Info -->
      <div style="background:#f8fafc;border-radius:12px;padding:16px 20px;margin-bottom:24px;border:1px solid #e2e8f0">
        <div style="font-size:16px;font-weight:600;color:#0f172a;margin-bottom:4px">${esc(rfqTitle)}</div>
        ${deadlineText ? `<div style="font-size:13px;color:#ef4444;font-weight:500">Son tarih: ${esc(deadlineText)}</div>` : ""}
        ${rfqNotes ? `<div style="font-size:13px;color:#64748b;margin-top:8px">${esc(rfqNotes)}</div>` : ""}
      </div>

      <!-- Items Table -->
      <table style="width:100%;border-collapse:collapse;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:28px">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Ürün</th>
            <th style="padding:10px 16px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Marka</th>
            <th style="padding:10px 16px;text-align:right;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Miktar</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>

      <!-- CTA -->
      <div style="text-align:center">
        <p style="font-size:14px;color:#64748b;margin-bottom:16px">
          Aşağıdaki butona tıklayarak fiyat teklifinizi girebilirsiniz.<br>
          <strong>Kayıt olmanıza gerek yoktur.</strong>
        </p>
        <a href="${safeLink}"
          style="display:inline-block;background:#2563eb;color:#ffffff;font-size:16px;font-weight:600;padding:14px 36px;border-radius:12px;text-decoration:none">
          Teklif Ver &rarr;
        </a>
        <p style="font-size:12px;color:#94a3b8;margin-top:12px">
          veya bu linki kopyalayın: <span style="color:#2563eb">${safeLink}</span>
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-radius:0 0 16px 16px;padding:16px 32px;border:1px solid #e2e8f0;border-top:none;text-align:center">
      <p style="margin:0;font-size:12px;color:#94a3b8">
        TeklifHub &middot; Denizcilik Tedarik Platformu<br>
        Bu mail otomatik gönderilmiştir. Yanıtlamayınız.
      </p>
    </div>

  </div>
</body>
</html>`;

  return resend.emails.send({
    from: "TeklifHub <onboarding@resend.dev>",
    to,
    subject: `Teklif Talebi: ${rfqTitle} — ${buyerCompany}`,
    html,
  });
}

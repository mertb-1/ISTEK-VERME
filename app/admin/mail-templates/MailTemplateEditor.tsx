"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { MAIL_DEFAULTS, type MailTemplateType } from "@/lib/mail-defaults";

type Template = {
  type: MailTemplateType;
  subject: string;
  greeting: string;
  body: string;
  signature: string;
};

type Props = {
  initial: Template[];
};

const TAB_LABELS: Record<MailTemplateType, string> = {
  supplier_rfq: "Tedarikçiye Teklif Maili",
  buyer_notification: "Alıcıya Bildirim Maili",
  approval: "Kayıt Onay Maili",
};

const TAB_ORDER: MailTemplateType[] = ["supplier_rfq", "buyer_notification", "approval"];

// Hangi alana hangi değişkenler gösterilecek
const VARS: Record<MailTemplateType, { subject: string[]; body: string[]; signature: string[] }> = {
  supplier_rfq: {
    subject: ["{{gemi_adi}}", "{{teklif_tarihi}}", "{{firma_adi}}", "{{teklif_no}}"],
    body: [
      "{{firma_adi}}","{{yetkili_adi}}","{{gemi_adi}}","{{son_tarih}}",
      "{{teklif_notu}}","{{teklif_no}}","{{firma_telefon}}","{{firma_mail}}",
    ],
    signature: ["{{yetkili_adi}}", "{{firma_adi}}", "{{firma_telefon}}", "{{firma_mail}}"],
  },
  buyer_notification: {
    subject: ["{{teklif_no}}", "{{tedarikci_adi}}"],
    body: ["{{alici_adi}}", "{{tedarikci_adi}}", "{{teklif_no}}", "{{cevap_tarihi}}"],
    signature: ["{{firma_adi}}"],
  },
  approval: {
    subject: ["{{firma_adi}}", "{{alici_adi}}"],
    body: ["{{alici_adi}}", "{{firma_adi}}"],
    signature: ["{{firma_adi}}"],
  },
};

const PREVIEW_DATA: Record<string, string> = {
  firma_adi: "Orange Shipping Co.",
  yetkili_adi: "Umut CADIRCI",
  gemi_adi: "M/V Lider Perihan",
  teklif_no: "RFQ-2026-001",
  teklif_tarihi: "19.05.2026",
  son_tarih: "26.05.2026",
  firma_telefon: "+90 212 000 00 00",
  firma_mail: "umut@orangeshipping.com",
  teklif_notu: "Acil ihtiyaç, lütfen önceliklendirin.",
  tedarikci_adi: "Kamarin Ship Supply",
  cevap_tarihi: "19.05.2026",
  alici_adi: "Umut CADIRCI",
  karsilastirma_linki: "#",
  giris_linki: "#",
};

function replacePreview(text: string): string {
  return Object.entries(PREVIEW_DATA).reduce(
    (t, [k, v]) => t.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), v),
    text
  );
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function buildPreviewHtml(tmpl: Template, type: MailTemplateType): string {
  const greeting = escHtml(replacePreview(tmpl.greeting));
  const body = escHtml(replacePreview(tmpl.body));
  const sig = escHtml(replacePreview(tmpl.signature));
  const companyName = escHtml(PREVIEW_DATA.firma_adi);

  const productTable =
    type === "supplier_rfq"
      ? `<table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:14px">
          <thead>
            <tr style="background:#1e40af;color:#fff">
              <th style="padding:10px 12px;text-align:left">Ürün</th>
              <th style="padding:10px 12px;text-align:center">Miktar</th>
              <th style="padding:10px 12px;text-align:center">Birim</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">Örnek Ürün 1</td><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e2e8f0">10</td><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e2e8f0">ADET</td></tr>
            <tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">Örnek Ürün 2</td><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e2e8f0">5</td><td style="padding:8px 12px;text-align:center;border-bottom:1px solid #e2e8f0">KG</td></tr>
          </tbody>
        </table>`
      : "";

  const buttonLabel =
    type === "buyer_notification"
      ? "Teklifleri Karşılaştır →"
      : type === "approval"
      ? "Giriş Yap →"
      : "Teklif Ver →";

  return `<div style="max-width:560px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#1e40af;padding:24px;text-align:center">
    <div style="font-size:20px;font-weight:700;color:#fff">${companyName}</div>
    <div style="color:#bfdbfe;font-size:11px;margin-top:4px">via PLATFORM</div>
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 12px;font-size:14px;color:#0f172a">${greeting}</p>
    <p style="white-space:pre-line;margin:0 0 20px;font-size:14px;color:#475569">${body}</p>
    ${productTable}
    <div style="text-align:center;margin:24px 0">
      <a href="#" style="display:inline-block;background:#1e40af;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">${buttonLabel}</a>
    </div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="color:#6b7280;font-size:13px;white-space:pre-line;margin:0">${sig}</p>
  </div>
  <div style="background:#f9fafb;padding:14px;text-align:center;color:#9ca3af;font-size:12px">
    ${companyName} · Denizcilik Tedarik Platformu
  </div>
</div>`;
}

export default function MailTemplateEditor({ initial }: Props) {
  const [activeTab, setActiveTab] = useState<MailTemplateType>("supplier_rfq");
  const [templates, setTemplates] = useState<Record<MailTemplateType, Template>>(() => {
    const map = {} as Record<MailTemplateType, Template>;
    for (const t of TAB_ORDER) {
      const found = initial.find((i) => i.type === t);
      map[t] = found ?? { ...MAIL_DEFAULTS[t] };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);

  // Refs for cursor-position insertion
  const subjectRef = useRef<HTMLInputElement>(null);
  const greetingRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const signatureRef = useRef<HTMLTextAreaElement>(null);

  const current = templates[activeTab];

  function setField(field: keyof Template, value: string) {
    setTemplates((prev) => ({
      ...prev,
      [activeTab]: { ...prev[activeTab], [field]: value },
    }));
  }

  function insertVar(
    varName: string,
    ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
    field: keyof Template
  ) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newVal = el.value.slice(0, start) + varName + el.value.slice(end);
    setField(field, newVal);
    // Restore cursor after state update
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + varName.length, start + varName.length);
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/mail-templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activeTab,
          subject: current.subject,
          greeting: current.greeting,
          body: current.body,
          signature: current.signature,
        }),
      });
      if (res.ok) {
        toast.success("Kaydedildi ✓");
      } else {
        toast.error("Kaydetme başarısız, tekrar deneyin.");
      }
    } catch {
      toast.error("Kaydetme başarısız, tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  function resetToDefault() {
    if (!confirm("Emin misiniz? Yaptığınız değişiklikler silinecek.")) return;
    setTemplates((prev) => ({
      ...prev,
      [activeTab]: { ...MAIL_DEFAULTS[activeTab] },
    }));
    toast("Varsayılan değerlere döndürüldü.");
  }

  function VarButtons({
    vars,
    field,
    inputRef,
  }: {
    vars: string[];
    field: keyof Template;
    inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>;
  }) {
    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {vars.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => insertVar(v, inputRef, field)}
            className="text-xs px-2.5 py-1 rounded-full border border-blue-900 text-blue-900 hover:bg-blue-900 hover:text-white transition-colors font-mono"
          >
            {v}
          </button>
        ))}
      </div>
    );
  }

  const varDefs = VARS[activeTab];
  const previewHtml = buildPreviewHtml(current, activeTab);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t
                ? "border-blue-900 text-blue-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Editör */}
        <div className="space-y-5">
          {/* Konu */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mail Konusu</label>
            <input
              ref={subjectRef}
              type="text"
              value={current.subject}
              onChange={(e) => setField("subject", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
            <VarButtons vars={varDefs.subject} field="subject" inputRef={subjectRef as React.RefObject<HTMLInputElement>} />
          </div>

          {/* Selamlama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Selamlama</label>
            <input
              ref={greetingRef}
              type="text"
              value={current.greeting}
              onChange={(e) => setField("greeting", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700"
            />
          </div>

          {/* Gövde */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mail İçeriği</label>
            <textarea
              ref={bodyRef}
              rows={8}
              value={current.body}
              onChange={(e) => setField("body", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 resize-y"
            />
            <VarButtons vars={varDefs.body} field="body" inputRef={bodyRef as React.RefObject<HTMLTextAreaElement>} />
          </div>

          {/* İmza */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İmza</label>
            <textarea
              ref={signatureRef}
              rows={4}
              value={current.signature}
              onChange={(e) => setField("signature", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-700 resize-y"
            />
            <VarButtons vars={varDefs.signature} field="signature" inputRef={signatureRef as React.RefObject<HTMLTextAreaElement>} />
          </div>

          {/* Butonlar */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-blue-900 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <button
              type="button"
              onClick={resetToDefault}
              className="border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Varsayılana Sıfırla
            </button>
          </div>
        </div>

        {/* Önizleme */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Canlı Önizleme</div>
          <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 overflow-auto max-h-[700px]">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>
    </div>
  );
}

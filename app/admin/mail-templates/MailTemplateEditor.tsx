"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { MAIL_DEFAULTS, type MailTemplateType } from "@/lib/mail-defaults";
import type { Align } from "@/lib/mail";

type Template = {
  type: MailTemplateType;
  subject: string;
  greeting: string;
  greeting_align: Align;
  body: string;
  body_align: Align;
  signature: string;
  signature_align: Align;
};

type Props = {
  initial: (Omit<Template, "greeting_align" | "body_align" | "signature_align"> & {
    greeting_align?: string | null;
    body_align?: string | null;
    signature_align?: string | null;
  })[];
};

const TAB_LABELS: Record<MailTemplateType, string> = {
  supplier_rfq: "Tedarikçiye Teklif",
  buyer_notification: "Alıcıya Bildirim",
  approval: "Kayıt Onayı",
  supplier_order_notification: "Sipariş Bildirimi",
};

const TAB_ORDER: MailTemplateType[] = ["supplier_rfq", "buyer_notification", "approval", "supplier_order_notification"];

const VARS: Record<MailTemplateType, { subject: string[]; body: string[]; signature: string[] }> = {
  supplier_rfq: {
    subject: ["{{gemi_adi}}", "{{teklif_tarihi}}", "{{firma_adi}}", "{{teklif_no}}"],
    body: [
      "{{firma_adi}}", "{{yetkili_adi}}", "{{gemi_adi}}", "{{son_tarih}}",
      "{{teklif_notu}}", "{{teklif_no}}", "{{firma_telefon}}", "{{firma_mail}}",
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
  supplier_order_notification: {
    subject: ["{{firma_adi}}", "{{siparis_no}}", "{{teklif_no}}"],
    body: [
      "{{firma_adi}}", "{{tedarikci_adi}}", "{{teklif_no}}", "{{siparis_no}}",
      "{{siparis_tutari}}", "{{para_birimi}}", "{{teslim_tarihi}}", "{{siparis_notu}}",
      "{{firma_telefon}}", "{{firma_mail}}",
    ],
    signature: ["{{firma_adi}}", "{{firma_telefon}}", "{{firma_mail}}"],
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
  siparis_no: "ORD-2026-001",
  siparis_tutari: "12.500,00",
  para_birimi: "USD",
  teslim_tarihi: "05.06.2026",
  siparis_notu: "Lütfen teslimat öncesinde iletişime geçin.",
  teklif_linki: "#",
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

  const buttonLabel =
    type === "buyer_notification"
      ? "Teklifleri Karşılaştır →"
      : type === "approval"
      ? "Giriş Yap →"
      : type === "supplier_order_notification"
      ? "Siparişi Görüntüle →"
      : "Teklif Ver →";

  return `<div style="max-width:560px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
  <div style="background:#1e40af;padding:24px;text-align:center">
    <div style="font-size:20px;font-weight:700;color:#fff">${companyName}</div>
    <div style="color:#bfdbfe;font-size:11px;margin-top:4px">via PLATFORM</div>
  </div>
  <div style="padding:28px">
    <p style="white-space:pre-line;margin:0 0 12px;font-size:14px;color:#0f172a;text-align:${tmpl.greeting_align}">${greeting}</p>
    <p style="white-space:pre-line;margin:0 0 20px;font-size:14px;color:#475569;text-align:${tmpl.body_align}">${body}</p>
    <div style="text-align:center;margin:24px 0">
      <a href="#" style="display:inline-block;background:#1e40af;color:#fff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none">${buttonLabel}</a>
    </div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="color:#6b7280;font-size:13px;white-space:pre-line;margin:0;text-align:${tmpl.signature_align}">${sig}</p>
  </div>
  <div style="background:#f9fafb;padding:14px;text-align:center;color:#9ca3af;font-size:12px">
    ${companyName} · Denizcilik Tedarik Platformu
  </div>
</div>`;
}

function toAlign(val: string | null | undefined): Align {
  if (val === "center" || val === "right") return val;
  return "left";
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e6ddd4",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "13px",
  color: "#111",
  background: "#fff",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "#7a6e67",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

function AlignButtons({
  value,
  onChange,
}: {
  value: Align;
  onChange: (a: Align) => void;
}) {
  const options: { val: Align; label: string }[] = [
    { val: "left", label: "Sol" },
    { val: "center", label: "Orta" },
    { val: "right", label: "Sağ" },
  ];
  return (
    <div className="flex gap-1 mt-1.5">
      {options.map((o) => (
        <button
          key={o.val}
          type="button"
          onClick={() => onChange(o.val)}
          className="text-xs px-3 py-1 rounded transition-colors"
          style={
            value === o.val
              ? { background: "#8b3a2a", color: "#fff", border: "1px solid #8b3a2a" }
              : { border: "1px solid #e6ddd4", color: "#7a6e67", background: "#fff" }
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function MailTemplateEditor({ initial }: Props) {
  const [activeTab, setActiveTab] = useState<MailTemplateType>("supplier_rfq");
  const [templates, setTemplates] = useState<Record<MailTemplateType, Template>>(() => {
    const map = {} as Record<MailTemplateType, Template>;
    for (const t of TAB_ORDER) {
      const found = initial.find((i) => i.type === t);
      map[t] = {
        ...(found ?? MAIL_DEFAULTS[t]),
        greeting_align: toAlign(found?.greeting_align),
        body_align: toAlign(found?.body_align),
        signature_align: toAlign(found?.signature_align),
      };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const greetingRef = useRef<HTMLTextAreaElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const signatureRef = useRef<HTMLTextAreaElement>(null);

  const current = templates[activeTab];

  function focusStyle(field: string): React.CSSProperties {
    return focused === field
      ? { ...inputStyle, border: "1px solid #8b3a2a", boxShadow: "0 0 0 3px #f0e9e2" }
      : inputStyle;
  }

  function setField(field: keyof Template, value: string | Align) {
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
          greeting_align: current.greeting_align,
          body: current.body,
          body_align: current.body_align,
          signature: current.signature,
          signature_align: current.signature_align,
        }),
      });
      if (res.ok) {
        toast.success("Kaydedildi.");
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
      [activeTab]: {
        ...MAIL_DEFAULTS[activeTab],
        greeting_align: "left",
        body_align: "left",
        signature_align: "left",
      },
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
            className="text-xs px-2.5 py-1 rounded-full font-mono transition-colors"
            style={{ border: "1px solid #d4c5b8", color: "#8b3a2a", background: "#fdf5f0" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#8b3a2a";
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#fdf5f0";
              (e.currentTarget as HTMLElement).style.color = "#8b3a2a";
            }}
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
      <div
        className="flex gap-0 overflow-x-auto"
        style={{ borderBottom: "1px solid #e6ddd4" }}
      >
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            className="px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              color: activeTab === t ? "#111" : "#7a6e67",
              borderBottom: activeTab === t ? "2px solid #8b3a2a" : "2px solid transparent",
              marginBottom: "-1px",
              background: "transparent",
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Editor */}
          <div className="space-y-5">
            {/* Subject */}
            <div>
              <label style={labelStyle}>Mail Konusu</label>
              <input
                ref={subjectRef}
                type="text"
                value={current.subject}
                onChange={(e) => setField("subject", e.target.value)}
                onFocus={() => setFocused("subject")}
                onBlur={() => setFocused(null)}
                style={focusStyle("subject")}
              />
              <VarButtons
                vars={varDefs.subject}
                field="subject"
                inputRef={subjectRef as React.RefObject<HTMLInputElement>}
              />
            </div>

            {/* Greeting */}
            <div>
              <label style={labelStyle}>Selamlama</label>
              <textarea
                ref={greetingRef}
                rows={2}
                value={current.greeting}
                onChange={(e) => setField("greeting", e.target.value)}
                onFocus={() => setFocused("greeting")}
                onBlur={() => setFocused(null)}
                style={{ ...focusStyle("greeting"), resize: "vertical" }}
              />
              <AlignButtons
                value={current.greeting_align}
                onChange={(a) => setField("greeting_align", a)}
              />
            </div>

            {/* Body */}
            <div>
              <label style={labelStyle}>Mail İçeriği</label>
              <textarea
                ref={bodyRef}
                rows={8}
                value={current.body}
                onChange={(e) => setField("body", e.target.value)}
                onFocus={() => setFocused("body")}
                onBlur={() => setFocused(null)}
                style={{ ...focusStyle("body"), resize: "vertical" }}
              />
              <AlignButtons
                value={current.body_align}
                onChange={(a) => setField("body_align", a)}
              />
              <VarButtons
                vars={varDefs.body}
                field="body"
                inputRef={bodyRef as React.RefObject<HTMLTextAreaElement>}
              />
            </div>

            {/* Signature */}
            <div>
              <label style={labelStyle}>İmza</label>
              <textarea
                ref={signatureRef}
                rows={4}
                value={current.signature}
                onChange={(e) => setField("signature", e.target.value)}
                onFocus={() => setFocused("signature")}
                onBlur={() => setFocused(null)}
                style={{ ...focusStyle("signature"), resize: "vertical" }}
              />
              <AlignButtons
                value={current.signature_align}
                onChange={(a) => setField("signature_align", a)}
              />
              <VarButtons
                vars={varDefs.signature}
                field="signature"
                inputRef={signatureRef as React.RefObject<HTMLTextAreaElement>}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 text-sm font-semibold disabled:opacity-60 transition-opacity"
                style={{
                  background: "#111",
                  color: "#fff",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: saving ? "not-allowed" : "pointer",
                }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button
                type="button"
                onClick={resetToDefault}
                className="text-sm font-medium transition-colors"
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #e6ddd4",
                  background: "#fff",
                  color: "#7a6e67",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#faf4ee";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#fff";
                }}
              >
                Varsayılana Sıfırla
              </button>
            </div>
          </div>

          {/* Preview */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#7a6e67", letterSpacing: "0.1em" }}
            >
              Canlı Önizleme
            </p>
            <div
              className="rounded-xl overflow-auto"
              style={{
                border: "1px solid #e6ddd4",
                background: "#faf4ee",
                padding: "16px",
                maxHeight: "700px",
              }}
            >
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

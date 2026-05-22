"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2, Building2, Mail, Phone, MapPin, ImageIcon } from "lucide-react";

type Buyer = {
  full_name: string;
  company_name: string;
  company_logo_url: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: "1px solid #e6ddd4",
  background: "#fff",
  fontSize: "14px",
  color: "#111",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 500,
  color: "#7a6e67",
  marginBottom: "6px",
};

function Field({
  label,
  icon,
  required,
  hint,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
          {required && <span style={{ color: "#8b3a2a" }}>*</span>}
        </span>
      </label>
      {children}
      {hint && (
        <p className="mt-1.5 text-xs" style={{ color: "#b0a49e" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export default function ProfileForm({ buyer, userId }: { buyer: Buyer; userId: string }) {
  const [logoUrl, setLogoUrl] = useState(buyer.company_logo_url ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [companyName, setCompanyName] = useState(buyer.company_name ?? "");
  const [companyEmail, setCompanyEmail] = useState(buyer.company_email ?? "");
  const [companyPhone, setCompanyPhone] = useState(buyer.company_phone ?? "");
  const [companyAddress, setCompanyAddress] = useState(buyer.company_address ?? "");
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const companyInitials = companyName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const focusStyle = (field: string): React.CSSProperties =>
    focusedField === field
      ? { ...inputStyle, border: "1px solid #8b3a2a", boxShadow: "0 0 0 3px #f0e9e2" }
      : inputStyle;

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo dosyası maksimum 2MB olabilir.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["png", "jpg", "jpeg", "svg"].includes(ext ?? "")) {
      toast.error("Sadece PNG, JPG veya SVG dosyaları yüklenebilir.");
      return;
    }

    setUploadingLogo(true);
    try {
      const supabase = createClient();
      const path = `${userId}/logo.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-logos")
        .getPublicUrl(path);

      const url = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("buyers")
        .update({ company_logo_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      setLogoUrl(url);
      toast.success("Logo güncellendi.");
    } catch {
      toast.error("Logo yüklenirken hata oluştu.");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("buyers")
        .update({
          company_name: companyName,
          company_email: companyEmail || null,
          company_phone: companyPhone || null,
          company_address: companyAddress || null,
        })
        .eq("id", userId);

      if (error) throw error;
      toast.success("Firma bilgileri kaydedildi.");
    } catch {
      toast.error("Kaydedilirken hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Logo card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid #e6ddd4", background: "#fff" }}
      >
        <div
          className="px-5 py-3.5 flex items-center gap-2"
          style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}
        >
          <ImageIcon className="w-4 h-4" style={{ color: "#8b3a2a" }} />
          <span className="text-sm font-semibold" style={{ color: "#111" }}>
            Firma Logosu
          </span>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-6">
            {/* Avatar / logo */}
            <div className="relative flex-shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Firma logosu"
                  className="w-24 h-24 rounded-2xl object-contain"
                  style={{ border: "1px solid #e6ddd4", background: "#faf4ee" }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-2xl font-bold"
                  style={{ background: "#f0e9e2", color: "#8b3a2a" }}
                >
                  {companyInitials || "?"}
                </div>
              )}
              {uploadingLogo && (
                <div
                  className="absolute inset-0 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.4)" }}
                >
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>

            {/* Upload controls */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg"
                className="hidden"
                onChange={handleLogoChange}
                disabled={uploadingLogo}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="flex items-center gap-2 text-sm font-medium disabled:opacity-50 transition-colors"
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #e6ddd4",
                  background: "#fff",
                  color: "#111",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#faf4ee";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#fff";
                }}
              >
                <Camera className="w-4 h-4" style={{ color: "#8b3a2a" }} />
                {uploadingLogo ? "Yükleniyor..." : "Logo Değiştir"}
              </button>
              <p className="text-xs mt-2" style={{ color: "#b0a49e" }}>
                PNG, JPG veya SVG · Maks. 2MB
              </p>
              {!logoUrl && (
                <p className="text-xs mt-1" style={{ color: "#b0a49e" }}>
                  Logo yoksa firma adının baş harfleri gösterilir.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Company info form */}
      <form
        onSubmit={handleSave}
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid #e6ddd4", background: "#fff" }}
      >
        <div
          className="px-5 py-3.5 flex items-center gap-2"
          style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}
        >
          <Building2 className="w-4 h-4" style={{ color: "#8b3a2a" }} />
          <span className="text-sm font-semibold" style={{ color: "#111" }}>
            Firma Bilgileri
          </span>
        </div>

        <div className="p-5 space-y-5">
          <Field
            label="Firma Adı"
            icon={<Building2 className="w-3.5 h-3.5" style={{ color: "#b0a49e" }} />}
            required
          >
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onFocus={() => setFocusedField("name")}
              onBlur={() => setFocusedField(null)}
              style={focusStyle("name")}
            />
          </Field>

          <Field
            label="Firma E-posta"
            icon={<Mail className="w-3.5 h-3.5" style={{ color: "#b0a49e" }} />}
            hint="Tedarikçiler tekliflerine bu adrese yanıt verebilir."
          >
            <input
              type="email"
              value={companyEmail}
              onChange={(e) => setCompanyEmail(e.target.value)}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              placeholder="iletisim@firma.com"
              style={focusStyle("email")}
            />
          </Field>

          <Field
            label="Firma Telefon"
            icon={<Phone className="w-3.5 h-3.5" style={{ color: "#b0a49e" }} />}
          >
            <input
              type="tel"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              onFocus={() => setFocusedField("phone")}
              onBlur={() => setFocusedField(null)}
              placeholder="+90 212 000 00 00"
              style={focusStyle("phone")}
            />
          </Field>

          <Field
            label="Firma Adresi"
            icon={<MapPin className="w-3.5 h-3.5" style={{ color: "#b0a49e" }} />}
          >
            <textarea
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              onFocus={() => setFocusedField("address")}
              onBlur={() => setFocusedField(null)}
              placeholder="Adres..."
              rows={3}
              style={{
                ...focusStyle("address"),
                resize: "none",
              }}
            />
          </Field>

          <div style={{ paddingTop: "4px" }}>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{
                padding: "11px 20px",
                borderRadius: "10px",
                background: "#111",
                color: "#fff",
                border: "none",
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

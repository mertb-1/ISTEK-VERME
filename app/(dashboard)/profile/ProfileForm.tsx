"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";

type Buyer = {
  full_name: string;
  company_name: string;
  company_logo_url: string | null;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
};

export default function ProfileForm({ buyer, userId }: { buyer: Buyer; userId: string }) {
  const [logoUrl, setLogoUrl] = useState(buyer.company_logo_url ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [companyName, setCompanyName] = useState(buyer.company_name ?? "");
  const [companyEmail, setCompanyEmail] = useState(buyer.company_email ?? "");
  const [companyPhone, setCompanyPhone] = useState(buyer.company_phone ?? "");
  const [companyAddress, setCompanyAddress] = useState(buyer.company_address ?? "");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const companyInitials = companyName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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

      // Cache-bust
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
    <div className="space-y-6">
      {/* Logo bölümü */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Firma Logosu</h2>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Firma logosu"
                className="w-24 h-24 rounded-full object-contain border border-gray-200 bg-white"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-700 flex items-center justify-center text-white text-2xl font-bold">
                {companyInitials || "?"}
              </div>
            )}
            {uploadingLogo && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
            )}
          </div>
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Logo Değiştir
            </button>
            <p className="text-xs text-gray-400 mt-2">PNG, JPG veya SVG · Maks. 2MB</p>
          </div>
        </div>
      </div>

      {/* Firma bilgileri formu */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Firma Bilgileri</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Firma Adı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Firma E-posta
          </label>
          <input
            type="email"
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
            placeholder="iletisim@firma.com"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Tedarikçilerin tekliflerine bu adrese yanıt verebilir.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Firma Telefon
          </label>
          <input
            type="tel"
            value={companyPhone}
            onChange={(e) => setCompanyPhone(e.target.value)}
            placeholder="+90 212 000 00 00"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Firma Adresi
          </label>
          <textarea
            value={companyAddress}
            onChange={(e) => setCompanyAddress(e.target.value)}
            placeholder="Adres..."
            rows={3}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </form>
    </div>
  );
}

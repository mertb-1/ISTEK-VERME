"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { createClient } from "@/lib/supabase/client";
import { ImagePlus, X, Loader2 } from "lucide-react";

type UploadedPhoto = {
  url: string;
  name: string;
};

type Props = {
  value: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  maxPhotos?: number;
};

export default function PhotoUploader({ value, onChange, maxPhotos = 5 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError("");

    const remaining = maxPhotos - value.length;
    if (remaining <= 0) {
      setError(`En fazla ${maxPhotos} fotoğraf yükleyebilirsiniz.`);
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);

    const supabase = createClient();
    const uploaded: UploadedPhoto[] = [];

    for (const file of selected) {
      try {
        // Sıkıştır
        const compressed = await imageCompression(file, {
          maxWidthOrHeight: 1920,
          initialQuality: 0.8,
          maxSizeMB: 0.5,
          useWebWorker: true,
        });

        // Benzersiz dosya adı
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(fileName, compressed, { contentType: compressed.type });

        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage
          .from("product-images")
          .getPublicUrl(fileName);

        uploaded.push({ url: data.publicUrl, name: file.name });
      } catch {
        setError("Bir fotoğraf yüklenemedi, diğerleri eklendi.");
      }
    }

    onChange([...value, ...uploaded]);
    setUploading(false);

    // Input'u sıfırla
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {/* Yüklenen fotoğraflar */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((photo, idx) => (
            <div key={idx} className="relative group">
              <img
                src={photo.url}
                alt={photo.name}
                className="w-20 h-20 object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Fotoğrafı kaldır"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Yükleme butonu */}
      {value.length < maxPhotos && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ImagePlus className="w-4 h-4" />
            )}
            {uploading
              ? "Yükleniyor..."
              : `Fotoğraf Ekle (${value.length}/${maxPhotos})`}
          </button>
        </>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
      <p className="text-xs text-gray-400">JPEG veya PNG · En fazla {maxPhotos} fotoğraf · Otomatik sıkıştırılır</p>
    </div>
  );
}

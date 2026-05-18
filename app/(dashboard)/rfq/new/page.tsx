"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, ChevronRight, ChevronDown, FileUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PhotoUploader from "@/components/PhotoUploader";

type UploadedPhoto = { url: string; name: string };

type Item = {
  product_name: string;
  brand: string;
  quantity: string;
  unit: string;
  description: string;
  impa_code: string;
  detailed_description: string;
  photos: UploadedPhoto[];
  order_no: number;
  expanded: boolean;
};

type Supplier = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  category: string;
};

const UNITS = ["adet", "kg", "lt", "m", "kutu", "paket"];

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function newItem(order_no: number): Item {
  return {
    product_name: "", brand: "", quantity: "", unit: "adet",
    description: "", impa_code: "", detailed_description: "",
    photos: [], order_no, expanded: false,
  };
}

export default function NewRfqPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([newItem(0)]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadMeta, setUploadMeta] = useState<{ sourceType: string; sourceFileUrl: string | null } | null>(null);

  useEffect(() => {
    const client = createClient();
    client
      .from("suppliers")
      .select("id, company_name, contact_name, email, category")
      .order("company_name")
      .then(({ data }) => setSuppliers(data ?? []));
  }, []);

  // Dosya yükleme akışından gelen ürünleri yükle
  useEffect(() => {
    if (searchParams.get("source") !== "upload") return;
    try {
      const raw = localStorage.getItem("rfq_upload_items");
      if (!raw) return;
      const payload = JSON.parse(raw) as {
        items: { product_name: string; brand: string; quantity: string; unit: string; impa_code: string; description: string }[];
        meta?: { vessel?: string; company?: string; date?: string; contact?: string };
        listType?: string;
        sourceFileUrl: string | null;
        sourceType: string;
      };
      const loaded: Item[] = payload.items.map((p, i) => ({
        product_name: p.product_name,
        brand: p.brand,
        quantity: p.quantity,
        unit: p.unit || "adet",
        description: p.description,
        impa_code: p.impa_code,
        detailed_description: "",
        photos: [],
        order_no: i,
        expanded: false,
      }));
      if (loaded.length > 0) setItems(loaded);
      setUploadMeta({ sourceType: payload.sourceType, sourceFileUrl: payload.sourceFileUrl });

      // Pre-fill title and notes from extracted metadata
      if (payload.meta) {
        const { vessel, company, date, contact } = payload.meta;
        const titleParts = [vessel, payload.listType].filter(Boolean);
        if (titleParts.length > 0) setTitle(titleParts.join(" - "));
        const noteParts = [
          company ? `Firma: ${company}` : "",
          date ? `Tarih: ${date}` : "",
          contact ? `İlgili: ${contact}` : "",
        ].filter(Boolean);
        if (noteParts.length > 0) setNotes(noteParts.join(" | "));
      }
      localStorage.removeItem("rfq_upload_items");
    } catch {
      // localStorage okunamazsa sessizce geç
    }
  }, [searchParams]);

  const addItem = () =>
    setItems((prev) => [...prev, newItem(prev.length)]);

  const removeItem = (idx: number) =>
    setItems((prev) =>
      prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order_no: i }))
    );

  const updateItem = <K extends keyof Item>(idx: number, field: K, value: Item[K]) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const toggleExpand = (idx: number) =>
    updateItem(idx, "expanded", !items[idx].expanded);

  const toggleSupplier = (id: string) =>
    setSelectedSuppliers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validItems = items.filter((i) => i.product_name.trim());
    if (validItems.length === 0) { setError("En az bir ürün eklemelisiniz."); return; }
    if (selectedSuppliers.size === 0) { setError("En az bir tedarikçi seçmelisiniz."); return; }

    // IMPA format doğrulama
    for (const item of validItems) {
      if (item.impa_code && !/^\d{6}$/.test(item.impa_code)) {
        setError(`"${item.product_name}" için IMPA kodu 6 haneli sayı olmalıdır.`);
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Oturum bulunamadı."); setSaving(false); return; }

    const { data: rfq, error: rfqErr } = await supabase
      .from("rfqs")
      .insert({
        title,
        notes,
        deadline: deadline || null,
        status: "open",
        buyer_id: user.id,
        source_type: uploadMeta?.sourceType ?? "manual",
        source_file_url: uploadMeta?.sourceFileUrl ?? null,
      })
      .select("id")
      .single();

    if (rfqErr) { setError(rfqErr.message); setSaving(false); return; }

    const { error: itemsErr } = await supabase.from("rfq_items").insert(
      validItems.map((item) => ({
        rfq_id: rfq.id,
        order_no: item.order_no,
        product_name: item.product_name,
        brand: item.brand,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit,
        description: item.description,
        impa_code: item.impa_code || null,
        detailed_description: item.detailed_description || null,
        photo_urls: item.photos.length > 0 ? item.photos.map((p) => p.url) : null,
      }))
    );
    if (itemsErr) { setError(itemsErr.message); setSaving(false); return; }

    const { error: recipientsErr } = await supabase.from("rfq_recipients").insert(
      Array.from(selectedSuppliers).map((supplier_id) => ({ rfq_id: rfq.id, supplier_id, status: "sent" }))
    );
    if (recipientsErr) { setError(recipientsErr.message); setSaving(false); return; }

    fetch("/api/rfq/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfq_id: rfq.id }),
    }).catch(() => {});

    router.push(`/rfq/${rfq.id}`);
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
          <a href="/rfq" className="hover:text-gray-600 transition-colors">Tekliflerim</a>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-600">Yeni Teklif</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Yeni Teklif Oluştur</h1>
            <p className="text-gray-500 mt-1">Ürün listesini doldurun, tedarikçileri seçin.</p>
          </div>
          <a
            href="/rfq/new/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors flex-shrink-0"
          >
            <FileUp className="w-4 h-4" />
            Dosyadan Yükle
          </a>
        </div>
        {uploadMeta && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-4 py-2.5 rounded-xl">
            <FileUp className="w-4 h-4 flex-shrink-0" />
            {items.length} ürün {uploadMeta.sourceType === "pdf" ? "PDF" : "Excel"} dosyasından yüklendi. Düzenleyip gönderebilirsiniz.
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bölüm 1 */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <h2 className="font-semibold text-gray-900">Teklif Bilgileri</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Teklif Başlığı <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Marmara Gemisi — Haziran 2025"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Son Tarih</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notlar</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ek bilgi..."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bölüm 2 — Ürün Listesi */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <h2 className="font-semibold text-gray-900">Ürün Listesi</h2>
            <span className="ml-auto text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
              {items.filter(i => i.product_name.trim()).length} ürün
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <div key={idx}>
                {/* Satır başlığı — her zaman görünür */}
                <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                  <span className="text-sm text-gray-400 font-medium w-5 flex-shrink-0">{idx + 1}</span>

                  {/* Temel alanlar */}
                  <input
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ürün adı *"
                    value={item.product_name}
                    onChange={(e) => updateItem(idx, "product_name", e.target.value)}
                  />
                  <input
                    className="w-28 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 hidden sm:block"
                    placeholder="Marka"
                    value={item.brand}
                    onChange={(e) => updateItem(idx, "brand", e.target.value)}
                  />
                  <input
                    className="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Miktar"
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                  />
                  <select
                    className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={item.unit}
                    onChange={(e) => updateItem(idx, "unit", e.target.value)}
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>

                  {/* Detay aç/kapa */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(idx)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 flex-shrink-0"
                    title="Detayları göster"
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${item.expanded ? "rotate-180" : ""}`} />
                    <span className="hidden sm:inline">Detay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Genişletilmiş detaylar */}
                {item.expanded && (
                  <div className="px-5 pb-5 pt-2 bg-gray-50 border-t border-gray-100 space-y-4">
                    {/* Mobilde marka buraya gelsin */}
                    <div className="sm:hidden">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">Marka</label>
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Marka"
                        value={item.brand}
                        onChange={(e) => updateItem(idx, "brand", e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          IMPA Kodu <span className="text-gray-400">(opsiyonel)</span>
                        </label>
                        <input
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Örn: 550101"
                          value={item.impa_code}
                          maxLength={6}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                            updateItem(idx, "impa_code", val);
                          }}
                        />
                        {item.impa_code && item.impa_code.length < 6 && (
                          <p className="text-xs text-amber-500 mt-1">{6 - item.impa_code.length} rakam daha</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1.5">
                          Kısa Not <span className="text-gray-400">(opsiyonel)</span>
                        </label>
                        <input
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Kısa not..."
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        Detaylı Açıklama <span className="text-gray-400">(opsiyonel)</span>
                      </label>
                      <textarea
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Teknik özellikler, boyutlar, standartlar..."
                        rows={3}
                        value={item.detailed_description}
                        onChange={(e) => updateItem(idx, "detailed_description", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">
                        Ürün Fotoğrafı <span className="text-gray-400">(opsiyonel)</span>
                      </label>
                      <PhotoUploader
                        value={item.photos}
                        onChange={(photos) => updateItem(idx, "photos", photos)}
                        maxPhotos={5}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-3 border-t border-gray-100">
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Ürün Ekle
            </button>
          </div>
        </div>

        {/* Bölüm 3 — Tedarikçi Seçimi */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <h2 className="font-semibold text-gray-900">Tedarikçi Seçimi</h2>
            {selectedSuppliers.size > 0 && (
              <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {selectedSuppliers.size} seçili
              </span>
            )}
          </div>
          <div className="p-6">
            {suppliers.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="mb-2">Henüz tedarikçi eklemediniz.</p>
                <a href="/suppliers" className="text-blue-600 hover:underline text-sm font-medium">
                  Tedarikçi ekle →
                </a>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {suppliers.map((s) => {
                  const selected = selectedSuppliers.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                        selected
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSupplier(s.id)}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          selected ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                        }`}>
                          {getInitials(s.company_name)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{s.company_name}</div>
                          {s.category && <div className="text-xs text-gray-400 truncate">{s.category}</div>}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 justify-end">
          <a
            href="/rfq"
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            İptal
          </a>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold transition-colors"
          >
            {saving ? "Oluşturuluyor..." : "Teklif Oluştur & Gönder"}
          </button>
        </div>
      </form>
    </div>
  );
}

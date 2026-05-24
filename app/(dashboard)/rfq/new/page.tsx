"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus, Trash2, ChevronRight, ChevronDown, FileUp,
  UserPlus, X, Loader2, Package, Users, Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import PhotoUploader from "@/components/PhotoUploader";
import { SUPPORTED_CURRENCIES, CURRENCY_LABELS } from "@/lib/currency";

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
  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadMeta, setUploadMeta] = useState<{ sourceType: string; sourceFileUrl: string | null } | null>(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ company_name: "", contact_name: "", email: "", category: "" });
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [addSupplierError, setAddSupplierError] = useState("");
  const newSupplierRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const client = createClient();
    client
      .from("suppliers")
      .select("id, company_name, contact_name, email, category")
      .order("company_name")
      .then(({ data }) => setSuppliers(data ?? []));
  }, []);

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
      /* localStorage okunamazsa sessizce geç */
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

  const handleAddSupplier = async () => {
    setAddSupplierError("");
    if (!newSupplier.company_name.trim()) { setAddSupplierError("Firma adı zorunludur."); return; }
    if (!newSupplier.email.trim()) { setAddSupplierError("E-posta zorunludur."); return; }
    setAddingSupplier(true);
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      const { data, error: insertError } = await client
        .from("suppliers")
        .insert({ ...newSupplier, buyer_id: user!.id })
        .select("id, company_name, contact_name, email, category")
        .single();
      if (insertError) throw insertError;
      setSuppliers((prev) => [...prev, data].sort((a, b) => a.company_name.localeCompare(b.company_name)));
      setSelectedSuppliers((prev) => { const next = new Set(prev); next.add(data.id); return next; });
      setNewSupplier({ company_name: "", contact_name: "", email: "", category: "" });
      setShowAddSupplier(false);
    } catch {
      setAddSupplierError("Tedarikçi eklenirken hata oluştu.");
    } finally {
      setAddingSupplier(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validItems = items.filter((i) => i.product_name.trim());
    if (validItems.length === 0) { setError("En az bir ürün eklemelisiniz."); return; }
    if (selectedSuppliers.size === 0) { setError("En az bir tedarikçi seçmelisiniz."); return; }

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

    const safeCurrency = (SUPPORTED_CURRENCIES as readonly string[]).includes(currency) ? currency : "USD";

    const { data: rfq, error: rfqErr } = await supabase
      .from("rfqs")
      .insert({
        title,
        notes,
        deadline: deadline || null,
        status: "open",
        buyer_id: user.id,
        currency: safeCurrency,
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

  const filledItemCount = items.filter((i) => i.product_name.trim()).length;

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 lg:px-8 py-6 lg:py-8">

      {/* Breadcrumb + başlık */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 text-xs mb-3" style={{ color: "#b0a49e" }}>
          <a href="/rfq" className="hover:underline transition-colors" style={{ color: "#7a6e67" }}>Tekliflerim</a>
          <ChevronRight className="w-3 h-3" />
          <span>Yeni Teklif</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#111" }}>Yeni Teklif Talebi</h1>
            <p className="mt-1 text-sm" style={{ color: "#7a6e67" }}>
              Ürünleri listeleyin, tedarikçileri seçin ve talepnizi gönderin.
            </p>
          </div>
          <a
            href="/rfq/new/upload"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium flex-shrink-0 transition-colors hover:bg-[#f5f0eb]"
            style={{ borderColor: "#e6ddd4", color: "#7a6e67" }}
          >
            <FileUp className="w-3.5 h-3.5" />
            Dosyadan Yükle
          </a>
        </div>

        {uploadMeta && (
          <div
            className="mt-4 flex items-center gap-2.5 text-sm px-4 py-3 rounded-xl"
            style={{ background: "#edf8f1", color: "#1a7a3a", border: "1px solid #b7e4c7" }}
          >
            <FileUp className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>{items.length} ürün</strong>{" "}
              {uploadMeta.sourceType === "pdf" ? "PDF" : "Excel"} dosyasından yüklendi.
              Kontrol edip gönderebilirsiniz.
            </span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        {/* 2-col desktop layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-6 items-start">

          {/* LEFT: basic info + product list */}
          <div className="space-y-5">

        {/* ── Bölüm 1: Teklif Bilgileri ── */}
        <Section index={1} icon={<Info className="w-3.5 h-3.5" />} title="Teklif Bilgileri">
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                Başlık <span style={{ color: "#8b3a2a" }}>*</span>
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Örn: Marmara Gemisi — Haziran 2025"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm transition-shadow focus:outline-none focus:ring-2"
                style={{
                  border: "1px solid #e6ddd4",
                  background: "#fff",
                  color: "#111",
                  focusRingColor: "#d4c5b8",
                } as React.CSSProperties}
                onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                  Son Cevap Tarihi
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm transition-shadow focus:outline-none"
                  style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                  Para Birimi
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none cursor-pointer"
                  style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{CURRENCY_LABELS[c]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                  Notlar
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ek bilgi, genel notlar..."
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm transition-shadow focus:outline-none"
                  style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                  onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Bölüm 2: Ürün Listesi ── */}
        <Section
          index={2}
          icon={<Package className="w-3.5 h-3.5" />}
          title="Ürün Listesi"
          badge={filledItemCount > 0 ? `${filledItemCount} ürün` : undefined}
        >
          <div className="divide-y" style={{ borderColor: "#f0e9e2" }}>
            {items.map((item, idx) => (
              <ItemRow
                key={idx}
                item={item}
                idx={idx}
                total={items.length}
                onUpdate={updateItem}
                onRemove={removeItem}
                onToggle={toggleExpand}
              />
            ))}
          </div>

          {/* Ürün Ekle butonu */}
          <div className="px-5 py-3.5" style={{ borderTop: "1px solid #f0e9e2" }}>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center gap-2 text-sm font-semibold transition-colors rounded-lg px-3 py-1.5 hover:bg-[#f5f0eb]"
              style={{ color: "#8b3a2a" }}
            >
              <Plus className="w-4 h-4" />
              Ürün Ekle
            </button>
          </div>
        </Section>

          </div>{/* end left column */}

          {/* RIGHT: suppliers + submit */}
          <div className="space-y-5">

        {/* ── Bölüm 3: Tedarikçiler ── */}
        <Section
          index={3}
          icon={<Users className="w-3.5 h-3.5" />}
          title="Tedarikçiler"
          badge={selectedSuppliers.size > 0 ? `${selectedSuppliers.size} seçili` : undefined}
          action={
            <button
              type="button"
              onClick={() => { setShowAddSupplier((v) => !v); setAddSupplierError(""); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
              style={
                showAddSupplier
                  ? { background: "#f5f0eb", color: "#7a6e67" }
                  : { background: "#f5f0eb", color: "#8b3a2a" }
              }
            >
              {showAddSupplier ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {showAddSupplier ? "Vazgeç" : "Yeni Tedarikçi"}
            </button>
          }
        >
          {/* Inline tedarikçi ekleme formu */}
          {showAddSupplier && (
            <div ref={newSupplierRef} className="px-5 py-4" style={{ background: "#faf4ee", borderBottom: "1px solid #e6ddd4" }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#8b3a2a" }}>
                Yeni Tedarikçi
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Firma Adı", key: "company_name", required: true, placeholder: "Acme Denizcilik", type: "text" },
                    { label: "İletişim Kişisi", key: "contact_name", required: false, placeholder: "Ali Yılmaz", type: "text" },
                    { label: "E-posta", key: "email", required: true, placeholder: "info@acme.com", type: "email" },
                    { label: "Kategori", key: "category", required: false, placeholder: "Gıda, Yağ, Makine...", type: "text" },
                  ].map(({ label, key, required, placeholder, type }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                        {label}{required && <span style={{ color: "#8b3a2a" }}> *</span>}
                      </label>
                      <input
                        type={type}
                        value={newSupplier[key as keyof typeof newSupplier]}
                        onChange={(e) => setNewSupplier((p) => ({ ...p, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none"
                        style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                        onFocus={(e) => (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4")}
                        onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                      />
                    </div>
                  ))}
                </div>
                {addSupplierError && (
                  <p className="text-xs font-medium" style={{ color: "#8b3a2a" }}>{addSupplierError}</p>
                )}
                <button
                  type="button"
                  onClick={handleAddSupplier}
                  disabled={addingSupplier}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
                  style={{ background: "#111" }}
                >
                  {addingSupplier && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {addingSupplier ? "Ekleniyor..." : "Ekle ve Seç"}
                </button>
              </div>
            </div>
          )}

          {/* Tedarikçi listesi */}
          <div className="p-5">
            {suppliers.length === 0 && !showAddSupplier ? (
              /* Boş durum */
              <div className="py-10 flex flex-col items-center gap-3 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: "#f5f0eb" }}
                >
                  <Users className="w-5 h-5" style={{ color: "#b0a49e" }} />
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#111" }}>Henüz tedarikçi yok</p>
                  <p className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>
                    Sisteme kayıtlı tedarikçiniz bulunmuyor.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddSupplier(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                  style={{ background: "#f5f0eb", color: "#8b3a2a" }}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  İlk tedarikçiyi ekle
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {suppliers.map((s) => {
                  const selected = selectedSuppliers.has(s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all select-none"
                      style={
                        selected
                          ? { border: "1.5px solid #8b3a2a", background: "#fdf5f0" }
                          : { border: "1.5px solid #e6ddd4", background: "#fff" }
                      }
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSupplier(s.id)}
                        className="sr-only"
                      />
                      {/* Custom checkbox */}
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                        style={
                          selected
                            ? { background: "#8b3a2a", border: "1.5px solid #8b3a2a" }
                            : { background: "#fff", border: "1.5px solid #d4c5b8" }
                        }
                      >
                        {selected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Avatar */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors"
                        style={
                          selected
                            ? { background: "#8b3a2a", color: "#fff" }
                            : { background: "#f5ede6", color: "#8b3a2a" }
                        }
                      >
                        {getInitials(s.company_name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate" style={{ color: "#111" }}>
                          {s.company_name}
                        </div>
                        <div className="text-xs truncate mt-0.5" style={{ color: "#b0a49e" }}>
                          {s.category || s.email}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </Section>

        {/* ── Hata mesajı ── */}
        {error && (
          <div
            className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl text-sm"
            style={{ background: "#fdf0ee", color: "#8b3a2a", border: "1px solid #f0cec6" }}
          >
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Eylem butonları ── */}
        <div className="flex items-center gap-3 justify-end pt-1">
          <a
            href="/rfq"
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-[#f5f0eb]"
            style={{ color: "#7a6e67" }}
          >
            İptal
          </a>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "#111" }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? "Oluşturuluyor..." : "Teklif Oluştur ve Gönder"}
          </button>
        </div>

          </div>{/* end right column */}
        </div>{/* end 2-col grid */}
      </form>
    </div>
  );
}

/* ── Section kapsayıcısı ── */
function Section({
  index,
  icon,
  title,
  badge,
  action,
  children,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid #e6ddd4", background: "#fff" }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{ borderBottom: "1px solid #e6ddd4", background: "#faf4ee" }}
      >
        <span
          className="w-6 h-6 rounded-full text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0"
          style={{ background: "#111" }}
        >
          {index}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: "#111" }}>
          {icon}
          {title}
        </span>
        {badge && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: "#f5f0eb", color: "#8b3a2a" }}
          >
            {badge}
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/* ── Ürün satırı ── */
function ItemRow({
  item,
  idx,
  total,
  onUpdate,
  onRemove,
  onToggle,
}: {
  item: Item;
  idx: number;
  total: number;
  onUpdate: <K extends keyof Item>(idx: number, field: K, value: Item[K]) => void;
  onRemove: (idx: number) => void;
  onToggle: (idx: number) => void;
}) {
  const inputStyle: React.CSSProperties = {
    border: "1px solid #e6ddd4",
    background: "#fff",
    color: "#111",
  };
  const focusHandlers = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      (e.currentTarget.style.boxShadow = "0 0 0 3px #e6ddd4"),
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      (e.currentTarget.style.boxShadow = "none"),
  };

  return (
    <div>
      {/* Ana satır */}
      <div className="flex items-center gap-2.5 px-5 py-3">
        {/* Sıra no */}
        <span
          className="text-xs font-semibold w-5 flex-shrink-0 text-center tabular-nums"
          style={{ color: "#b0a49e" }}
        >
          {idx + 1}
        </span>

        {/* Ürün adı — en geniş */}
        <input
          className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm focus:outline-none"
          style={inputStyle}
          placeholder="Ürün adı *"
          value={item.product_name}
          onChange={(e) => onUpdate(idx, "product_name", e.target.value)}
          {...focusHandlers}
        />

        {/* Marka — masaüstünde görünür */}
        <input
          className="w-24 px-3 py-2 rounded-lg text-sm focus:outline-none hidden sm:block"
          style={inputStyle}
          placeholder="Marka"
          value={item.brand}
          onChange={(e) => onUpdate(idx, "brand", e.target.value)}
          {...focusHandlers}
        />

        {/* Miktar + Birim — gruplu */}
        <div className="flex items-center flex-shrink-0" style={{ border: "1px solid #e6ddd4", borderRadius: "0.5rem", overflow: "hidden" }}>
          <input
            className="w-16 px-2.5 py-2 text-sm focus:outline-none text-center"
            style={{ border: "none", background: "#fff", color: "#111" }}
            placeholder="Adet"
            type="number"
            min="0"
            step="any"
            value={item.quantity}
            onChange={(e) => onUpdate(idx, "quantity", e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            onFocus={(e) => (e.currentTarget.parentElement!.style.boxShadow = "0 0 0 3px #e6ddd4")}
            onBlur={(e) => (e.currentTarget.parentElement!.style.boxShadow = "none")}
          />
          <div className="w-px self-stretch" style={{ background: "#e6ddd4" }} />
          <select
            className="w-20 px-2 py-2 text-sm focus:outline-none bg-white cursor-pointer"
            style={{ border: "none", color: "#7a6e67" }}
            value={item.unit}
            onChange={(e) => onUpdate(idx, "unit", e.target.value)}
          >
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        {/* Detay toggle */}
        <button
          type="button"
          onClick={() => onToggle(idx)}
          className="flex items-center gap-1 text-xs px-2.5 py-2 rounded-lg transition-colors flex-shrink-0"
          style={
            item.expanded
              ? { background: "#f5f0eb", color: "#8b3a2a" }
              : { background: "transparent", color: "#b0a49e" }
          }
          title="Detayları göster/gizle"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${item.expanded ? "rotate-180" : ""}`} />
          <span className="hidden sm:inline font-medium">Detay</span>
        </button>

        {/* Sil */}
        <button
          type="button"
          onClick={() => onRemove(idx)}
          disabled={total === 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 disabled:opacity-25 disabled:cursor-not-allowed"
          style={{ color: "#b0a49e" }}
          onMouseEnter={(e) => { if (total > 1) { e.currentTarget.style.background = "#fdf0ee"; e.currentTarget.style.color = "#8b3a2a"; } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#b0a49e"; }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Genişletilmiş detaylar */}
      {item.expanded && (
        <div
          className="px-5 pb-5 pt-4 space-y-4"
          style={{ background: "#faf4ee", borderTop: "1px solid #f0e9e2" }}
        >
          {/* Mobilde marka */}
          <div className="sm:hidden">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>Marka</label>
            <input
              className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none"
              style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
              placeholder="Marka"
              value={item.brand}
              onChange={(e) => onUpdate(idx, "brand", e.target.value)}
              {...focusHandlers}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                IMPA Kodu <span style={{ color: "#b0a49e", fontWeight: 400 }}>(opsiyonel)</span>
              </label>
              <input
                className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none"
                style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                placeholder="Örn: 550101"
                value={item.impa_code}
                maxLength={6}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  onUpdate(idx, "impa_code", val);
                }}
                {...focusHandlers}
              />
              {item.impa_code && item.impa_code.length < 6 && (
                <p className="text-xs mt-1" style={{ color: "#b0a49e" }}>
                  {6 - item.impa_code.length} rakam daha
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
                Kısa Not <span style={{ color: "#b0a49e", fontWeight: 400 }}>(opsiyonel)</span>
              </label>
              <input
                className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none"
                style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
                placeholder="Kısa not..."
                value={item.description}
                onChange={(e) => onUpdate(idx, "description", e.target.value)}
                {...focusHandlers}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#7a6e67" }}>
              Detaylı Açıklama <span style={{ color: "#b0a49e", fontWeight: 400 }}>(opsiyonel)</span>
            </label>
            <textarea
              className="w-full px-3.5 py-2.5 rounded-lg text-sm focus:outline-none resize-none"
              style={{ border: "1px solid #e6ddd4", background: "#fff", color: "#111" }}
              placeholder="Teknik özellikler, boyutlar, standartlar..."
              rows={3}
              value={item.detailed_description}
              onChange={(e) => onUpdate(idx, "detailed_description", e.target.value)}
              {...focusHandlers}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: "#7a6e67" }}>
              Ürün Fotoğrafı <span style={{ color: "#b0a49e", fontWeight: 400 }}>(opsiyonel)</span>
            </label>
            <PhotoUploader
              value={item.photos}
              onChange={(photos) => onUpdate(idx, "photos", photos)}
              maxPhotos={5}
            />
          </div>
        </div>
      )}
    </div>
  );
}

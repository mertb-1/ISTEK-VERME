"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Item = {
  product_name: string;
  brand: string;
  quantity: string;
  unit: string;
  description: string;
  order_no: number;
};

type Supplier = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  category: string;
};

const UNITS = ["adet", "kg", "lt", "m", "kutu", "paket"];

export default function NewRfqPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([
    { product_name: "", brand: "", quantity: "", unit: "adet", description: "", order_no: 0 },
  ]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const client = createClient();
    client
      .from("suppliers")
      .select("id, company_name, contact_name, email, category")
      .order("company_name")
      .then(({ data }) => setSuppliers(data ?? []));
  }, []);

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { product_name: "", brand: "", quantity: "", unit: "adet", description: "", order_no: prev.length },
    ]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order_no: i })));

  const updateItem = (idx: number, field: keyof Item, value: string) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

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

    setSaving(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Oturum bulunamadı."); setSaving(false); return; }

    const { data: rfq, error: rfqErr } = await supabase
      .from("rfqs")
      .insert({ title, notes, deadline: deadline || null, status: "open", buyer_id: user.id })
      .select("id")
      .single();

    if (rfqErr) { setError(rfqErr.message); setSaving(false); return; }

    const { error: itemsErr } = await supabase.from("rfq_items").insert(
      validItems.map((item) => ({ ...item, quantity: parseFloat(item.quantity) || 1, rfq_id: rfq.id }))
    );
    if (itemsErr) { setError(itemsErr.message); setSaving(false); return; }

    const { error: recipientsErr } = await supabase.from("rfq_recipients").insert(
      Array.from(selectedSuppliers).map((supplier_id) => ({ rfq_id: rfq.id, supplier_id, status: "sent" }))
    );
    if (recipientsErr) { setError(recipientsErr.message); setSaving(false); return; }

    // Mail gönder (arka planda, hata olsa da devam et)
    fetch("/api/rfq/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfq_id: rfq.id }),
    }).catch(() => {});

    router.push(`/rfq/${rfq.id}`);
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Yeni Teklif Oluştur</h1>
        <p className="text-gray-500 mt-1">Ürün listesini doldurun, tedarikçileri seçin.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Başlık & Meta */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Teklif Bilgileri</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Teklif Başlığı *</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Örn: Marmara Gemisi — Haziran 2025"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {/* Ürün Listesi */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Ürün Listesi</h2>
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-12 gap-2">
                  <input
                    className="col-span-4 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ürün adı *"
                    value={item.product_name}
                    onChange={(e) => updateItem(idx, "product_name", e.target.value)}
                  />
                  <input
                    className="col-span-3 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Marka"
                    value={item.brand}
                    onChange={(e) => updateItem(idx, "brand", e.target.value)}
                  />
                  <input
                    className="col-span-2 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Miktar"
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                  />
                  <select
                    className="col-span-2 px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={item.unit}
                    onChange={(e) => updateItem(idx, "unit", e.target.value)}
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="col-span-1 flex items-center justify-center text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addItem}
            className="mt-3 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus className="w-4 h-4" />
            Ürün Ekle
          </button>
        </div>

        {/* Tedarikçi Seçimi */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">Tedarikçi Seçimi</h2>
          <p className="text-sm text-gray-500 mb-4">
            Seçilen tedarikçilere otomatik mail gönderilecek.
          </p>

          {suppliers.length === 0 ? (
            <div className="text-center py-6 text-gray-400">
              Henüz tedarikçi eklemediniz.{" "}
              <a href="/suppliers" className="text-blue-600 hover:underline">Tedarikçi ekle →</a>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {suppliers.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSuppliers.has(s.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSuppliers.has(s.id)}
                    onChange={() => toggleSupplier(s.id)}
                    className="rounded text-blue-600"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{s.company_name}</div>
                    {s.category && <div className="text-xs text-gray-400">{s.category}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}

        <div className="flex gap-3 justify-end">
          <a
            href="/rfq"
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            İptal
          </a>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium transition-colors"
          >
            {saving ? "Oluşturuluyor..." : "Teklif Oluştur & Gönder"}
          </button>
        </div>
      </form>
    </div>
  );
}

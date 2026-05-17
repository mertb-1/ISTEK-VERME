"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronRight } from "lucide-react";
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
    setItems((prev) =>
      prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, order_no: i }))
    );

  const updateItem = (idx: number, field: keyof Item, value: string) =>
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );

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
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
          <a href="/rfq" className="hover:text-gray-600 transition-colors">Tekliflerim</a>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-600">Yeni Teklif</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Yeni Teklif Oluştur</h1>
        <p className="text-gray-500 mt-1">Ürün listesini doldurun, tedarikçileri seçin.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <h2 className="font-semibold text-gray-900">Ürün Listesi</h2>
            <span className="ml-auto text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
              {items.filter(i => i.product_name.trim()).length} ürün
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 w-8">#</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">Ürün Adı</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 w-36">Marka</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 w-28">Miktar</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-gray-500 w-28">Birim</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3 text-sm text-gray-400 font-medium">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ürün adı *"
                        value={item.product_name}
                        onChange={(e) => updateItem(idx, "product_name", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Marka"
                        value={item.brand}
                        onChange={(e) => updateItem(idx, "brand", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <input
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Miktar"
                        type="number"
                        min="0"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, "quantity", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={item.unit}
                        onChange={(e) => updateItem(idx, "unit", e.target.value)}
                      >
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <div className="grid grid-cols-2 gap-2.5">
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

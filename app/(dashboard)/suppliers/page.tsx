"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const CATEGORIES = ["Yedek Parça", "Yağ/Kimyasal", "Gıda/Zahire", "Teknik Hizmet", "Diğer"];

type Supplier = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  category: string;
  notes: string;
};

const emptyForm = { company_name: "", contact_name: "", email: "", phone: "", category: "", notes: "" };

const categoryColors: Record<string, { bg: string; color: string }> = {
  "Yedek Parça":   { bg: "#f0edf8", color: "#5b3fa0" },
  "Yağ/Kimyasal":  { bg: "#fef5e4", color: "#a06a00" },
  "Gıda/Zahire":   { bg: "#edf8f1", color: "#1a7a3a" },
  "Teknik Hizmet": { bg: "#fdf0ee", color: "#8b3a2a" },
  "Diğer":         { bg: "#f5f0eb", color: "#7a6e67" },
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const supabase = createClient();

  const fetchSuppliers = useCallback(async () => {
    const { data } = await supabase.from("suppliers").select("*").order("company_name");
    setSuppliers(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(""); setOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ company_name: s.company_name, contact_name: s.contact_name ?? "", email: s.email, phone: s.phone ?? "", category: s.category ?? "", notes: s.notes ?? "" });
    setError("");
    setOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    if (editing) {
      const { error } = await supabase.from("suppliers").update(form).eq("id", editing.id);
      if (error) { setError(error.message); setSaving(false); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("suppliers").insert({ ...form, buyer_id: user!.id });
      if (error) { setError(error.message); setSaving(false); return; }
    }
    await fetchSuppliers();
    setOpen(false);
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu tedarikçiyi silmek istediğinizden emin misiniz?")) return;
    await supabase.from("suppliers").delete().eq("id", id);
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="p-8 max-w-5xl">
      {/* Heading */}
      <div className="mb-8">
        <p className="text-xs tracking-widest mb-3" style={{ color: "#7a6e67", letterSpacing: "0.12em" }}>
          TEDARİKÇİLER · {suppliers.length} AKTİF
        </p>
        <div className="flex items-end justify-between">
          <h1 className="font-display text-5xl leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Tedarikçi <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>rehberi.</em>
          </h1>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded mb-1"
            style={{ background: "#111", color: "#fff" }}
          >
            <Plus className="w-4 h-4" />
            Tedarikçi ekle
          </button>
        </div>
        <p className="text-sm mt-2" style={{ color: "#7a6e67" }}>
          Cevap oranı ve ortalama yanıt süresi son 30 günden hesaplanır. Teklif talebi atarken havuz buradan oluşur.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm" style={{ color: "#7a6e67" }}>Yükleniyor...</div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-xl px-6 py-16 text-center" style={{ background: "#fff", border: "1px solid #e6ddd4" }}>
          <p className="text-sm mb-4" style={{ color: "#7a6e67" }}>Henüz tedarikçi eklenmedi.</p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 text-sm font-semibold px-5 py-2.5 rounded"
            style={{ background: "#111", color: "#fff" }}
          >
            <Plus className="w-4 h-4" />
            İlk Tedarikçiyi Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suppliers.map((s) => {
            const initials = s.company_name.split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
            const catStyle = categoryColors[s.category] ?? categoryColors["Diğer"];
            return (
              <div
                key={s.id}
                className="rounded-xl p-5"
                style={{ background: "#fff", border: "1px solid #e6ddd4" }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: "#f5ede6", color: "#8b3a2a" }}
                    >
                      {initials}
                    </div>
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "#111" }}>{s.company_name}</div>
                      {s.contact_name && (
                        <div className="text-xs mt-0.5" style={{ color: "#7a6e67" }}>{s.contact_name}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      className="w-7 h-7 flex items-center justify-center rounded transition-colors"
                      style={{ color: "#b0a49e" }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="w-7 h-7 flex items-center justify-center rounded transition-colors"
                      style={{ color: "#b0a49e" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Category tags */}
                {s.category && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded"
                      style={{ background: catStyle.bg, color: catStyle.color }}
                    >
                      {s.category}
                    </span>
                  </div>
                )}

                {/* Email */}
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: "1px solid #f0e8e0" }}>
                  <span className="text-xs" style={{ color: "#7a6e67" }}>{s.email}</span>
                  <button
                    className="text-xs font-medium px-2.5 py-1 rounded border"
                    style={{ borderColor: "#e6ddd4", color: "#111" }}
                  >
                    Teklif ekle
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Tedarikçi Düzenle" : "Yeni Tedarikçi Ekle"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="company_name">Firma Adı *</Label>
                <Input id="company_name" required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Deniz Lojistik A.Ş." />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_name">Yetkili Adı</Label>
                <Input id="contact_name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Ahmet Yılmaz" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-posta *</Label>
                <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="info@firma.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0532 000 00 00" />
                </div>
                <div className="space-y-1.5">
                  <Label>Kategori</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notlar</Label>
                <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Özel notlar..." rows={3} />
              </div>
              {error && <div className="text-sm px-3 py-2 rounded" style={{ background: "#fdf0ee", color: "#8b3a2a" }}>{error}</div>}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button type="submit" disabled={saving} style={{ background: "#111", color: "#fff" }}>{saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Ekle"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

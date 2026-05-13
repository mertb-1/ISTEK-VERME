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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    const { data } = await supabase
      .from("suppliers")
      .select("*")
      .order("company_name");
    setSuppliers(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setError(""); setOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm({ company_name: s.company_name, contact_name: s.contact_name ?? "", email: s.email, phone: s.phone ?? "", category: s.category ?? "", notes: s.notes ?? "" }); setError(""); setOpen(true); };

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
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tedarikçi Rehberi</h1>
          <p className="text-gray-500 mt-1">
            {suppliers.length} tedarikçi kayıtlı
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />
          Tedarikçi Ekle
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Yükleniyor...</div>
        ) : suppliers.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-500 mb-4">Henüz tedarikçi eklenmedi.</p>
            <Button onClick={openAdd} variant="outline">İlk Tedarikçiyi Ekle</Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Firma / Yetkili</TableHead>
                <TableHead>E-posta</TableHead>
                <TableHead>Telefon</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{s.company_name}</div>
                    {s.contact_name && <div className="text-xs text-gray-400 mt-0.5">{s.contact_name}</div>}
                  </TableCell>
                  <TableCell className="text-gray-600">{s.email}</TableCell>
                  <TableCell className="text-gray-600">{s.phone || "—"}</TableCell>
                  <TableCell>
                    {s.category && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                        {s.category}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

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
              {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>İptal</Button>
              <Button type="submit" disabled={saving}>{saving ? "Kaydediliyor..." : editing ? "Güncelle" : "Ekle"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

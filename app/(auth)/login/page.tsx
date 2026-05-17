"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Anchor, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (authError) {
      setError("E-posta veya şifre hatalı.");
      setLoading(false);
      return;
    }

    const roleRes = await fetch("/api/auth/check-role");
    const { role, status: buyerStatus } = await roleRes.json();

    if (role === "admin") {
      router.push("/admin/buyers");
      router.refresh();
      return;
    }

    if (role === "buyer" && buyerStatus === "approved") {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    if (role === "buyer" && buyerStatus === "rejected") {
      await supabase.auth.signOut();
      setError("Hesabınız reddedilmiştir. Lütfen bizimle iletişime geçin.");
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.push("/beklemede");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Anchor className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">TeklifHub</span>
        </div>

        <div>
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Denizcilik sektörü için<br />akıllı teklif platformu
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Tedarikçilerinize otomatik teklif talepleri gönderin, fiyatları karşılaştırın.
          </p>
          <ul className="space-y-3">
            {[
              "Tedarikçilere otomatik mail ile teklif talebi",
              "Magic link ile kayıtsız tedarikçi cevabı",
              "Anlık fiyat karşılaştırma tablosu",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-slate-300">
                <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-slate-600 text-sm">TeklifHub. Tüm hakları saklıdır.</p>
      </div>

      <div className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Anchor className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">TeklifHub</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Giriş Yap</h1>
            <p className="text-gray-500 mt-1">Hesabınıza erişmek için giriş yapın.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="ahmet@firma.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Şifre</label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Şifreniz"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Hesabın yok mu?{" "}
            <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Kayıt ol
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

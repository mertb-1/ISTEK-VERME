"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/config";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);
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
    <div className="min-h-screen flex flex-col" style={{ background: "#faf4ee" }}>
      {/* Top bar */}
      <div className="w-full flex items-center justify-between px-6 py-3" style={{ background: "#111111" }}>
        <span className="text-white text-xs tracking-widest uppercase font-medium" style={{ letterSpacing: "0.12em" }}>
          {APP_NAME}
        </span>
        <span className="text-white text-xs tracking-widest uppercase" style={{ letterSpacing: "0.1em", opacity: 0.4 }}>
          GİRİŞ
        </span>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-10">
            <p className="text-xs tracking-widest uppercase mb-3" style={{ color: "#7a6e67", letterSpacing: "0.12em" }}>
              GİRİŞ
            </p>
            <h1 className="font-display text-5xl leading-tight mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Tekrar{" "}
              <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>hoş geldin.</em>
            </h1>
            <p className="text-sm" style={{ color: "#7a6e67" }}>
              Filo satın almaları, tedarikçi rehberi ve açık RFQ&apos;lar — tek pencerede.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#7a6e67", letterSpacing: "0.05em" }}>
                Şirket e-postası
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-black"
                style={{ background: "#fff", borderColor: "#e6ddd4", color: "#111" }}
                placeholder="alper@turkarmator.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#7a6e67", letterSpacing: "0.05em" }}>
                Parola
              </label>
              <input
                type="password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-black"
                style={{ background: "#fff", borderColor: "#e6ddd4", color: "#111" }}
                placeholder="••••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded"
                  style={{ accentColor: "#111" }}
                />
                <span className="text-xs" style={{ color: "#7a6e67" }}>Bu cihazda hatırla</span>
              </label>
              <button type="button" className="text-xs underline" style={{ color: "#7a6e67" }}>
                Parolayı sıfırla
              </button>
            </div>

            {error && (
              <div className="text-sm px-3 py-2.5 rounded border" style={{ background: "#fdf0ee", borderColor: "#e6c4be", color: "#8b3a2a" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 text-sm font-semibold rounded transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "#111111", color: "#fff" }}
            >
              {loading ? "Giriş yapılıyor..." : <>Hesabıma gir →</>}
            </button>
          </form>

          <div className="mt-5">
            <Link
              href="/register"
              className="text-sm underline"
              style={{ color: "#7a6e67" }}
            >
              Yeni hesap aç
            </Link>
          </div>

          {/* Supplier info */}
          <div className="mt-8 p-4 rounded border text-xs" style={{ background: "#f5ede6", borderColor: "#e6ddd4", color: "#7a6e67" }}>
            <span className="font-semibold" style={{ color: "#111" }}>Tedarikçi misiniz?</span> Kayıt gerekmiyor. Aldığınız davet mailindeki linke tıklayın — formu doldurun, gönderin.
          </div>
        </div>
      </div>
    </div>
  );
}

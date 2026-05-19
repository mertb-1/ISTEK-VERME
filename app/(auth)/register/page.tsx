"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/config";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    company_name: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          company_name: form.company_name,
          phone: form.phone,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/beklemede");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#faf4ee" }}>
      {/* Top bar */}
      <div className="w-full flex items-center justify-between px-6 py-3" style={{ background: "#111111" }}>
        <span className="text-white text-xs tracking-widest uppercase font-medium" style={{ letterSpacing: "0.12em" }}>
          {APP_NAME}
        </span>
        <span className="text-white text-xs tracking-widest uppercase" style={{ letterSpacing: "0.1em", opacity: 0.4 }}>
          KAYIT
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {/* Step indicator */}
          <div className="flex items-center gap-0 mb-10">
            {["01 Şirket", "02 Yetkili", "03 Filo"].map((step, i) => (
              <div key={step} className="flex items-center">
                <span
                  className="text-xs font-medium px-3 py-1"
                  style={{
                    color: i === 0 ? "#111" : "#b0a49e",
                    borderBottom: i === 0 ? "2px solid #111" : "2px solid transparent",
                    paddingBottom: "6px",
                  }}
                >
                  {step}
                </span>
              </div>
            ))}
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-display text-5xl leading-tight mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Şirket{" "}
              <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>bilgileri.</em>
            </h1>
            <p className="text-sm" style={{ color: "#7a6e67" }}>
              Bilgiler admin tarafından doğrulanır. Onay genelde 4 saat içinde gelir.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#7a6e67", letterSpacing: "0.05em" }}>
                Şirket unvanı
              </label>
              <input
                type="text"
                required
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-black"
                style={{ background: "#fff", borderColor: "#e6ddd4", color: "#111" }}
                placeholder="Örn. Karadeniz Bulk Lojistik A.Ş."
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "#7a6e67", letterSpacing: "0.05em" }}>
                Ad Soyad
              </label>
              <input
                type="text"
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2.5 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-black"
                style={{ background: "#fff", borderColor: "#e6ddd4", color: "#111" }}
                placeholder="Alper Yılmaz"
              />
            </div>

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
                placeholder="alper@firma.com"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#7a6e67", letterSpacing: "0.05em" }}>
                  Telefon
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-black"
                  style={{ background: "#fff", borderColor: "#e6ddd4", color: "#111" }}
                  placeholder="0532 000 00 00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#7a6e67", letterSpacing: "0.05em" }}>
                  Parola
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm rounded border focus:outline-none focus:ring-2 focus:ring-black"
                  style={{ background: "#fff", borderColor: "#e6ddd4", color: "#111" }}
                  placeholder="Min. 6 karakter"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm px-3 py-2.5 rounded border" style={{ background: "#fdf0ee", borderColor: "#e6c4be", color: "#8b3a2a" }}>
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Link href="/login" className="text-sm underline" style={{ color: "#7a6e67" }}>
                Girişe dön
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 text-sm font-semibold rounded transition-opacity disabled:opacity-60 flex items-center gap-2"
                style={{ background: "#111111", color: "#fff" }}
              >
                {loading ? "Kaydediliyor..." : <>Devam et →</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

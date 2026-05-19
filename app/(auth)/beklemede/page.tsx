"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { APP_NAME } from "@/lib/config";

export default function BeklemePage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#faf4ee" }}>
      {/* Top bar */}
      <div className="w-full flex items-center justify-between px-6 py-3" style={{ background: "#111111" }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-white text-xs font-bold" style={{ background: "#8b3a2a" }}>
            t
          </div>
          <span className="text-white text-xs font-medium tracking-wide">{APP_NAME}</span>
        </div>
        <span className="text-white text-xs tracking-widest uppercase" style={{ letterSpacing: "0.1em", opacity: 0.4 }}>
          HESAP DURUMU · ONAY BEKLİYOR
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-xl border p-8" style={{ background: "#fff", borderColor: "#e6ddd4" }}>
            {/* Brand in card */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold" style={{ background: "#111" }}>
                t
              </div>
              <span className="text-sm font-medium">teklif <em style={{ color: "#8b3a2a" }}>al</em></span>
            </div>

            <p className="text-xs tracking-widest uppercase mb-2" style={{ color: "#7a6e67", letterSpacing: "0.12em" }}>
              HESAP DURUMU · ONAY BEKLİYOR
            </p>
            <h1 className="font-display text-4xl leading-tight mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Liman <em style={{ color: "#8b3a2a", fontStyle: "italic" }}>memurları</em> sizi<br />inceliyor.
            </h1>
            <p className="text-sm mb-6" style={{ color: "#7a6e67" }}>
              Şirket bilgilerinizi aldık. Admin doğrulamasından sonra (ortalama 4 saat) tedarikçi havuzunuzu kurabilir, ilk RFQ&apos;yu gönderebilirsiniz.
            </p>

            {/* Info boxes */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="rounded p-3" style={{ background: "#f5ede6", border: "1px solid #e6ddd4" }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#7a6e67", letterSpacing: "0.1em" }}>ŞİRKET</p>
                <p className="text-sm font-medium" style={{ color: "#111" }}>—</p>
              </div>
              <div className="rounded p-3" style={{ background: "#f5ede6", border: "1px solid #e6ddd4" }}>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#7a6e67", letterSpacing: "0.1em" }}>BAŞVURU TARİHİ</p>
                <p className="text-sm font-medium" style={{ color: "#111" }}>
                  {new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                </p>
              </div>
            </div>

            {/* Notice */}
            <div className="rounded p-3 mb-6 flex items-start gap-2" style={{ background: "#f5ede6", border: "1px solid #e6ddd4" }}>
              <span className="mt-0.5 text-xs" style={{ color: "#8b3a2a" }}>✉</span>
              <p className="text-xs" style={{ color: "#7a6e67" }}>
                Onaylandığında e-posta adresinize bildirim gelir. Bu sekmeyi açık tutabilirsiniz, otomatik yenilenecek.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={handleSignOut}
                className="text-sm underline"
                style={{ color: "#7a6e67" }}
              >
                Çıkış yap
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

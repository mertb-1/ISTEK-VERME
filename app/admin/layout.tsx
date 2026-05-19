import Link from "next/link";
import { APP_NAME } from "@/lib/config";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#faf4ee" }}>
      {/* Top bar */}
      <nav
        className="flex items-center justify-between px-6 py-3"
        style={{ background: "#111111" }}
      >
        <div className="flex items-center gap-6">
          <span className="text-white text-xs font-medium tracking-widest uppercase" style={{ letterSpacing: "0.12em" }}>
            {APP_NAME} · Admin
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/admin/buyers"
              className="text-xs tracking-wide transition-colors"
              style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em" }}
            >
              Alıcı Yönetimi
            </Link>
            <Link
              href="/admin/mail-templates"
              className="text-xs tracking-wide transition-colors"
              style={{ color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em" }}
            >
              Mail Şablonları
            </Link>
          </div>
        </div>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Admin Paneli</span>
      </nav>
      {children}
    </div>
  );
}

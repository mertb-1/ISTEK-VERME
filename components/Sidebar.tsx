"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, FileText, Plus, Users, LogOut, Menu, X, UserCircle, ShoppingBag } from "lucide-react";
import { APP_NAME } from "@/lib/config";

const navItems = [
  { href: "/dashboard",  label: "Dashboard",    icon: LayoutDashboard },
  { href: "/rfq",        label: "Tekliflerim",  icon: FileText },
  { href: "/orders",     label: "Siparişlerim", icon: ShoppingBag },
  { href: "/suppliers",  label: "Tedarikçiler", icon: Users },
  { href: "/profile",    label: "Profil",       icon: UserCircle },
];

export default function Sidebar({
  buyer,
}: {
  buyer: { full_name: string; company_name: string; company_logo_url?: string | null };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const companyInitials = buyer.company_name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const userInitials = buyer.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function isActive(href: string) {
    if (href === "/rfq") return pathname.startsWith("/rfq") && !pathname.startsWith("/rfq/new");
    if (href === "/orders") return pathname.startsWith("/orders");
    return pathname === href;
  }

  const currentLabel = navItems.find((item) => isActive(item.href))?.label ?? "";

  return (
    <>
      {/* Topbar */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 h-12"
        style={{ background: "#111111", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          className="w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          <Menu className="w-4 h-4" />
        </button>

        <span className="text-white text-sm font-medium flex-1 truncate">{currentLabel}</span>

        <Link
          href="/rfq/new"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded transition-opacity hover:opacity-85"
          style={{ background: "#fff", color: "#111" }}
        >
          <Plus className="w-3 h-3" />
          Yeni Teklif
        </Link>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "#111111", borderRight: "1px solid rgba(255,255,255,0.06)" }}
        aria-label="Navigasyon menüsü"
      >
        {/* Close */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Menüyü kapat"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded transition-colors hover:bg-white/10"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Brand */}
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {buyer.company_logo_url ? (
            <img
              src={buyer.company_logo_url}
              alt={buyer.company_name}
              className="object-contain"
              style={{ height: 28, maxWidth: 120 }}
            />
          ) : (
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: "#8b3a2a" }}
              >
                {companyInitials}
              </div>
              <div>
                <div className="text-white text-sm font-medium leading-tight">{buyer.company_name}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{APP_NAME}</div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors"
                style={{
                  background: active ? "rgba(255,255,255,0.1)" : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.5)",
                  borderLeft: active ? "2px solid #fff" : "2px solid transparent",
                  marginLeft: 0,
                  paddingLeft: active ? "10px" : "12px",
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Divider + action */}
          <div className="pt-3 mt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <Link
              href="/rfq/new"
              className="flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">Yeni Teklif</span>
            </Link>
          </div>
        </nav>

        {/* User */}
        <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: "#444" }}
            >
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="text-white text-xs font-medium truncate">{buyer.full_name}</div>
              <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{buyer.company_name}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors hover:bg-white/5"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Çıkış Yap
          </button>
        </div>
      </aside>
    </>
  );
}

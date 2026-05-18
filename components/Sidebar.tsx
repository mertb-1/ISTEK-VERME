"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { LayoutDashboard, FileText, Plus, Users, LogOut, Anchor, Menu, X } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Ana Sayfa", icon: LayoutDashboard },
  { href: "/rfq", label: "Tekliflerim", icon: FileText },
  { href: "/rfq/new", label: "Yeni Teklif", icon: Plus },
  { href: "/suppliers", label: "Tedarikçiler", icon: Users },
];

export default function Sidebar({
  buyer,
}: {
  buyer: { full_name: string; company_name: string };
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

  const initials = buyer.full_name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      {/* Topbar — her ekran boyutunda görünür */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 flex items-center gap-3 px-4 h-14">
        <button
          onClick={() => setOpen(true)}
          aria-label="Menüyü aç"
          className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center flex-shrink-0">
            <Anchor className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-white font-bold text-sm tracking-tight">GetYourQuote</span>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-slate-900 flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Navigasyon menüsü"
      >
        {/* Kapat butonu */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Menüyü kapat"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Anchor className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm tracking-tight">GetYourQuote</div>
              <div className="text-slate-500 text-xs mt-0.5">Denizcilik Platformu</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href === "/rfq" &&
                pathname.startsWith("/rfq") &&
                pathname !== "/rfq/new");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-blue-400" : ""}`} />
                <span className="flex-1">{item.label}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info + sign out */}
        <div className="px-3 py-4 border-t border-slate-800 space-y-0.5">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">{buyer.full_name}</div>
              <div className="text-slate-500 text-xs truncate">{buyer.company_name}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            Çıkış Yap
          </button>
        </div>
      </aside>
    </>
  );
}

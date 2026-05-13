"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const navItems = [
  { href: "/dashboard", label: "Ana Sayfa", icon: "🏠" },
  { href: "/rfq", label: "Tekliflerim", icon: "📋" },
  { href: "/rfq/new", label: "Yeni Teklif", icon: "➕" },
  { href: "/suppliers", label: "Tedarikçiler", icon: "👥" },
];

export default function Sidebar({
  buyer,
}: {
  buyer: { full_name: string; company_name: string };
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-5 border-b border-gray-200">
        <div className="text-xl font-bold text-blue-600">⚓ TeklifHub</div>
        <div className="text-xs text-gray-500 mt-0.5">Denizcilik Platformu</div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              pathname === item.href
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <div className="px-3 py-2 mb-1">
          <div className="text-sm font-medium text-gray-900 truncate">
            {buyer.full_name}
          </div>
          <div className="text-xs text-gray-500 truncate">{buyer.company_name}</div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <span>🚪</span> Çıkış Yap
        </button>
      </div>
    </aside>
  );
}

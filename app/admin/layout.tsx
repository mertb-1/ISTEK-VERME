import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-800 mr-4">Admin Paneli</span>
        <Link
          href="/admin/buyers"
          className="text-sm text-gray-600 hover:text-blue-700 font-medium"
        >
          Alıcı Yönetimi
        </Link>
        <Link
          href="/admin/mail-templates"
          className="text-sm text-gray-600 hover:text-blue-700 font-medium"
        >
          Mail Şablonları
        </Link>
      </nav>
      {children}
    </div>
  );
}

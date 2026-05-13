"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function BeklemePage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          Hesabınız İnceleniyor
        </h1>
        <p className="text-gray-500 mb-6">
          Kayıt talebiniz alındı. Yönetici onayından sonra sisteme giriş
          yapabileceksiniz. Bu işlem genellikle birkaç saat içinde tamamlanır.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-700 text-sm">
          Onaylandığınızda kayıt olduğunuz e-posta adresine bildirim
          gönderilecektir.
        </div>
        <button
          onClick={handleSignOut}
          className="inline-block mt-6 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Çıkış yap ve giriş sayfasına dön
        </button>
      </div>
    </div>
  );
}

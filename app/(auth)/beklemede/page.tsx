"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CheckCircle, Clock, Circle } from "lucide-react";

export default function BeklemePage() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const steps = [
    { label: "Başvuru Alındı", done: true, icon: CheckCircle },
    { label: "İnceleniyor", done: false, icon: Clock, active: true },
    { label: "Onaylandı", done: false, icon: Circle },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-sm w-full">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-2">Hesabınız İnceleniyor</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            Kayıt talebiniz alındı. Yönetici onayından sonra sisteme giriş yapabileceksiniz. Bu işlem genellikle birkaç saat içinde tamamlanır.
          </p>

          <div className="flex items-center justify-between mb-8 px-2">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex-1 flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-2 ${
                    step.done
                      ? "bg-emerald-100"
                      : step.active
                      ? "bg-amber-100"
                      : "bg-gray-100"
                  }`}>
                    <Icon className={`w-4 h-4 ${
                      step.done
                        ? "text-emerald-600"
                        : step.active
                        ? "text-amber-500"
                        : "text-gray-300"
                    }`} />
                  </div>
                  <span className={`text-xs font-medium ${
                    step.done
                      ? "text-emerald-600"
                      : step.active
                      ? "text-amber-600"
                      : "text-gray-400"
                  }`}>
                    {step.label}
                  </span>
                  {i < steps.length - 1 && (
                    <div className="absolute" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-blue-700 text-sm mb-6">
            Onaylandığınızda kayıt olduğunuz e-posta adresine bildirim gönderilecektir.
          </div>

          <button
            onClick={handleSignOut}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ← Çıkış yap ve giriş sayfasına dön
          </button>
        </div>
      </div>
    </div>
  );
}

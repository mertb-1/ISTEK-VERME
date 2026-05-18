import { APP_NAME } from "@/lib/config";

export default function QuoteSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-10">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Teklifiniz Alındı!</h1>
          <p className="text-slate-500">
            Teklifiniz başarıyla iletildi. Alıcı firma değerlendirme sonucunda sizinle iletişime geçecektir.
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100 text-xs text-slate-400">
            {APP_NAME} — Denizcilik Tedarik Platformu
          </div>
        </div>
      </div>
    </div>
  );
}

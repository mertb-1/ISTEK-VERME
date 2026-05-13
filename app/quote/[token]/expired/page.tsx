export default function QuoteExpiredPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl border border-slate-200 p-10">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Bağlantı Süresi Doldu</h1>
          <p className="text-slate-500">
            Bu teklif bağlantısının süresi geçmiştir. Alıcı firma ile iletişime geçerek yeni bir bağlantı talep edebilirsiniz.
          </p>
          <div className="mt-6 pt-6 border-t border-slate-100 text-xs text-slate-400">
            TeklifHub — Denizcilik Tedarik Platformu
          </div>
        </div>
      </div>
    </div>
  );
}

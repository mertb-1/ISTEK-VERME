import { APP_NAME } from "@/lib/config";

type Props = {
  buyerCompany: string;
  buyerLogoUrl?: string | null;
  rfqTitle: string;
  confirmedAmount?: number | null;
  expectedDelivery?: string | null;
  buyerNote?: string | null;
  supplierName?: string;
};

export default function QuoteAwarded({
  buyerCompany,
  buyerLogoUrl,
  rfqTitle,
  confirmedAmount,
  expectedDelivery,
  buyerNote,
  supplierName,
}: Props) {
  const deliveryText = expectedDelivery
    ? new Date(expectedDelivery).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const amountText =
    confirmedAmount != null
      ? Number(confirmedAmount).toLocaleString("tr-TR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Alıcı firma kimliği */}
      <div className="bg-white border-b border-gray-200 py-5">
        <div className="max-w-4xl mx-auto px-4 text-center">
          {buyerLogoUrl ? (
            <img
              src={buyerLogoUrl}
              alt={buyerCompany}
              className="h-12 mx-auto object-contain mb-2"
            />
          ) : (
            <p className="text-lg font-bold text-slate-800 mb-1">{buyerCompany}</p>
          )}
          <p className="text-sm text-gray-500">
            Bu teklif talebi <strong>{buyerCompany}</strong> tarafından gönderilmiştir.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-gray-400 text-sm">{APP_NAME}</span>
          </div>
          <h1 className="text-xl font-bold text-white">{rfqTitle}</h1>
          <p className="text-sm text-gray-400 mt-1">Alıcı: <span className="text-gray-200 font-medium">{buyerCompany}</span></p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Teklifiniz Onaylandı!</h2>
          <p className="text-gray-500 mb-6">
            {buyerCompany} firması teklifinizi sipariş olarak onaylamıştır.
            {supplierName ? ` Sayın ${supplierName}, tebrikler!` : ""}
          </p>

          {(amountText || deliveryText || buyerNote) && (
            <div className="bg-gray-50 rounded-xl p-5 text-left space-y-3 max-w-sm mx-auto">
              {amountText && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Onaylanan Tutar</span>
                  <span className="font-semibold text-gray-900">{amountText}</span>
                </div>
              )}
              {deliveryText && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Teslim Tarihi</span>
                  <span className="font-semibold text-gray-900">{deliveryText}</span>
                </div>
              )}
              {buyerNote && (
                <div className="text-sm">
                  <span className="text-gray-500 block mb-1">Alıcı Notu</span>
                  <span className="text-gray-700">{buyerNote}</span>
                </div>
              )}
            </div>
          )}

          <p className="mt-6 text-xs text-gray-400">
            Sipariş detayları için {buyerCompany} firmasıyla iletişime geçebilirsiniz.
          </p>
        </div>
      </div>
    </div>
  );
}

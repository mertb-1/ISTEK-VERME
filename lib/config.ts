// Uygulama adı: her firma kendi Vercel deployment'ında
// NEXT_PUBLIC_APP_NAME env variable'ını set eder.
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "GetYourQuote";

// Para birimi: DB'de saklanmıyor; tüm görüntülemeler bu sabiti kullanır.
export const DEFAULT_CURRENCY = "USD";

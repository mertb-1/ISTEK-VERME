export const SUPPORTED_CURRENCIES = ["USD", "EUR", "TRY"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "USD ($)",
  EUR: "EUR (€)",
  TRY: "TRY (₺)",
};

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  TRY: "₺",
};

function isCurrency(value: unknown): value is Currency {
  return SUPPORTED_CURRENCIES.includes(value as Currency);
}

export function getCurrencySymbol(currency: unknown): string {
  return isCurrency(currency) ? CURRENCY_SYMBOLS[currency] : CURRENCY_SYMBOLS["USD"];
}

export function formatMoney(amount: number | null | undefined, currency: unknown): string {
  if (amount == null) return "—";
  const code: Currency = isCurrency(currency) ? currency : "USD";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

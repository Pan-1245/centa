export const CURRENCIES = {
  THB: { code: "THB", symbol: "฿", locale: "th-TH", decimals: 2 },
  USD: { code: "USD", symbol: "$", locale: "en-US", decimals: 2 },
  JPY: { code: "JPY", symbol: "¥", locale: "ja-JP", decimals: 0 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export type ExchangeRates = Record<string, number>;

export type RateData = {
  rates: ExchangeRates;
  updatedAt: number; // unix timestamp in seconds
};

export async function fetchExchangeRates(): Promise<RateData> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/THB", {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    return {
      rates: data.rates ?? { THB: 1, USD: 0.029, JPY: 4.3 },
      updatedAt: data.time_last_update_unix ?? Math.floor(Date.now() / 1000),
    };
  } catch {
    return {
      rates: { THB: 1, USD: 0.029, JPY: 4.3 },
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }
}

export function timeAgo(unixSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatNumber(
  amount: number,
  decimals: number,
  locale: string,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

export function formatAmount(
  amountInThb: number,
  currency: CurrencyCode,
  rates: ExchangeRates,
): string {
  const config = CURRENCIES[currency];
  const converted =
    currency === "THB" ? amountInThb : amountInThb * (rates[currency] ?? 1);
  return `${config.symbol}${formatNumber(converted, config.decimals, config.locale)}`;
}

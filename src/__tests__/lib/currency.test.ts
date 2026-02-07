import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatAmount,
  timeAgo,
  fetchExchangeRates,
  CURRENCIES,
} from "@/lib/currency";

describe("formatAmount", () => {
  const rates = { THB: 1, USD: 0.029, JPY: 4.3 };

  it("formats THB without conversion", () => {
    expect(formatAmount(1000, "THB", rates)).toBe("฿1,000.00");
  });

  it("formats THB with decimals", () => {
    expect(formatAmount(1234.56, "THB", rates)).toBe("฿1,234.56");
  });

  it("converts and formats USD", () => {
    // 1000 * 0.029 = 29
    expect(formatAmount(1000, "USD", rates)).toBe("$29.00");
  });

  it("converts and formats JPY with 0 decimals", () => {
    // 1000 * 4.3 = 4300
    expect(formatAmount(1000, "JPY", rates)).toBe("¥4,300");
  });

  it("handles zero amount", () => {
    expect(formatAmount(0, "THB", rates)).toBe("฿0.00");
  });

  it("falls back to rate=1 when rate is missing", () => {
    expect(formatAmount(500, "USD", {})).toBe("$500.00");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for less than 60 seconds ago", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 30)).toBe("just now");
  });

  it("returns minutes ago", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 300)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 7200)).toBe("2h ago");
  });

  it("returns days ago", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 172800)).toBe("2d ago");
  });
});

describe("fetchExchangeRates", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed rates on successful fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            rates: { THB: 1, USD: 0.03, JPY: 4.5 },
            time_last_update_unix: 1700000000,
          }),
      }),
    );

    const result = await fetchExchangeRates();
    expect(result.rates.USD).toBe(0.03);
    expect(result.rates.JPY).toBe(4.5);
    expect(result.updatedAt).toBe(1700000000);
  });

  it("returns fallback rates on fetch failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );

    const result = await fetchExchangeRates();
    expect(result.rates.USD).toBe(0.029);
    expect(result.rates.JPY).toBe(4.3);
    expect(result.rates.THB).toBe(1);
  });

  it("returns fallback rates when response has no rates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({}),
      }),
    );

    const result = await fetchExchangeRates();
    expect(result.rates.USD).toBe(0.029);
  });
});

describe("CURRENCIES constant", () => {
  it("has THB with correct config", () => {
    expect(CURRENCIES.THB.symbol).toBe("฿");
    expect(CURRENCIES.THB.decimals).toBe(2);
  });

  it("has USD with correct config", () => {
    expect(CURRENCIES.USD.symbol).toBe("$");
    expect(CURRENCIES.USD.decimals).toBe(2);
  });

  it("has JPY with 0 decimals", () => {
    expect(CURRENCIES.JPY.symbol).toBe("¥");
    expect(CURRENCIES.JPY.decimals).toBe(0);
  });
});

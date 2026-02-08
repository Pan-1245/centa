import { redirect } from "next/navigation";

import { SummaryYearCard } from "@/components/summary/summary-year-card";
import { Card, CardContent } from "@/components/ui/card";
import { getOrCreateUserConfig } from "@/lib/actions/config";
import { getMonthlySummary } from "@/lib/actions/transactions";
import {
  CURRENCIES,
  fetchExchangeRates,
  timeAgo,
  type CurrencyCode,
} from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function SummaryPage() {
  const [summary, config, rateData] = await Promise.all([
    getMonthlySummary(),
    getOrCreateUserConfig(),
    fetchExchangeRates(),
  ]);
  if (!config) redirect("/setup");

  const currency = (config.currency ?? "THB") as CurrencyCode;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Summary</h1>
        <p className="text-muted-foreground">
          Monthly income and expenses grouped by year.
        </p>
      </div>

      {currency !== "THB" && (
        <p className="text-muted-foreground text-xs">
          1 THB = {CURRENCIES[currency].symbol}
          {rateData.rates[currency]?.toFixed(currency === "JPY" ? 2 : 4) ??
            "?"}{" "}
          · Updated {timeAgo(rateData.updatedAt)}
        </p>
      )}

      {summary.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            No transactions yet. Add some to see your monthly summary.
          </CardContent>
        </Card>
      ) : (
        summary.map(({ year, months }) => (
          <SummaryYearCard
            key={year}
            year={year}
            months={months}
            currency={currency}
            rates={rateData.rates}
          />
        ))
      )}
    </div>
  );
}

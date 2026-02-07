import { Card, CardContent } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getMonthlySummary, getOrCreateUserConfig } from "@/lib/actions";
import {
  fetchExchangeRates,
  timeAgo,
  CURRENCIES,
  type CurrencyCode,
} from "@/lib/currency";
import { SummaryYearCard } from "@/components/summary-year-card";

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
        <p className="text-xs text-muted-foreground">
          1 THB = {CURRENCIES[currency].symbol}
          {rateData.rates[currency]?.toFixed(currency === "JPY" ? 2 : 4) ??
            "?"}{" "}
          · Updated {timeAgo(rateData.updatedAt)}
        </p>
      )}

      {summary.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
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

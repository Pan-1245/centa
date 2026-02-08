import { redirect } from "next/navigation";

import { SavingsGoals } from "@/components/savings/savings-goals";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOrCreateUserConfig } from "@/lib/actions/config";
import { getDashboardStats } from "@/lib/actions/dashboard";
import { processRecurringTransactions } from "@/lib/actions/recurring";
import { getSavingsGoals } from "@/lib/actions/savings";
import {
  CURRENCIES,
  fetchExchangeRates,
  formatAmount,
  timeAgo,
  type CurrencyCode,
} from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await processRecurringTransactions();

  const [stats, config, rateData, goals] = await Promise.all([
    getDashboardStats(),
    getOrCreateUserConfig(),
    fetchExchangeRates(),
    getSavingsGoals(),
  ]);
  if (!stats || !config) redirect("/setup");

  const currency = (config.currency ?? "THB") as CurrencyCode;
  const fmt = (amount: number) =>
    formatAmount(amount, currency, rateData.rates);

  function trend(current: number, previous: number, lowerIsBetter: boolean) {
    if (previous === 0) return null;
    const pctChange = ((current - previous) / previous) * 100;
    const improved = lowerIsBetter ? pctChange < 0 : pctChange > 0;
    const arrow = pctChange > 0 ? "\u25B2" : "\u25BC";
    const color = improved
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
    return {
      text: `${arrow} ${Math.abs(pctChange).toFixed(0)}% vs last month`,
      color,
    };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your budget and spending.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Income",
            value: stats.totalIncome,
            prev: stats.prevIncome,
            lowerIsBetter: false,
            border: "border-l-green-500",
            color: "text-green-600 dark:text-green-400",
          },
          {
            label: "Total Expenses",
            value: stats.totalExpenses,
            prev: stats.prevExpenses,
            lowerIsBetter: true,
            border: "border-l-red-500",
            color: "text-red-600 dark:text-red-400",
          },
          {
            label: "Total Savings",
            value: stats.totalSavings,
            prev: stats.prevSavings,
            lowerIsBetter: false,
            border: "border-l-blue-500",
            color: "text-blue-600 dark:text-blue-400",
          },
          {
            label: "Remaining",
            value: stats.remaining,
            prev: stats.prevRemaining,
            lowerIsBetter: false,
            border: "border-l-primary",
            color: "",
          },
        ].map((card) => {
          const t = trend(card.value, card.prev, card.lowerIsBetter);
          return (
            <Card key={card.label} className={`border-l-4 ${card.border}`}>
              <CardHeader className="pb-2">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className={`text-2xl ${card.color}`}>
                  {fmt(card.value)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {t ? (
                  <p className={`text-xs ${t.color}`}>{t.text}</p>
                ) : (
                  <p className="text-muted-foreground text-xs">This month</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {currency !== "THB" && (
        <p className="text-muted-foreground text-xs">
          1 THB = {CURRENCIES[currency].symbol}
          {rateData.rates[currency]?.toFixed(currency === "JPY" ? 2 : 4) ??
            "?"}{" "}
          · Updated {timeAgo(rateData.updatedAt)}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Budget Breakdown</CardTitle>
          <CardDescription>
            How your spending compares to your active plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.breakdown.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No categories in your active plan.
            </p>
          ) : stats.totalIncome === 0 ? (
            <p className="text-muted-foreground text-sm">
              Add income transactions to see your budget breakdown.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.breakdown.map((cat) => {
                const rawPct =
                  cat.budgeted > 0 ? (cat.spent / cat.budgeted) * 100 : 0;
                const diff = cat.budgeted - cat.spent;
                const atBudget = diff >= 0 && diff < 1;
                const pct = atBudget ? 100 : Math.min(100, rawPct);
                const over = rawPct > 100;
                const warning = !atBudget && rawPct >= 80 && rawPct <= 100;

                return (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-medium">
                        {cat.name} ({cat.percentage}%)
                        {over && (
                          <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                            Over budget
                          </span>
                        )}
                        {warning && (
                          <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                            Approaching limit
                          </span>
                        )}
                      </span>
                      <span
                        className={`text-xs sm:text-sm ${over ? "text-red-600 dark:text-red-400" : warning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground sm:text-foreground"}`}
                      >
                        {fmt(cat.spent)} / {fmt(cat.budgeted)}
                      </span>
                    </div>
                    <div className="bg-muted h-2 rounded-full">
                      <div
                        className={`h-full rounded-full ${
                          over
                            ? "bg-red-500"
                            : warning
                              ? "bg-amber-500"
                              : "bg-primary"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <SavingsGoals
        goals={goals}
        savingsCategories={config.activePlan.categories.filter(
          (c) => c.isSavings,
        )}
        currency={currency}
        rates={rateData.rates}
      />
    </div>
  );
}

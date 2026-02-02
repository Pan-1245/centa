"use client";

import { Fragment, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatAmount,
  type CurrencyCode,
  type ExchangeRates,
} from "@/lib/currency";
import type { MonthTransaction, MonthSummary } from "@/lib/actions";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const typeColor: Record<string, string> = {
  INCOME: "text-green-600 dark:text-green-400",
  EXPENSE: "text-red-600 dark:text-red-400",
  SAVINGS: "text-blue-600 dark:text-blue-400",
};

export function SummaryYearCard({
  year,
  months,
  currency,
  rates,
}: {
  year: number;
  months: MonthSummary[];
  currency: CurrencyCode;
  rates: ExchangeRates;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const fmt = (amount: number) => formatAmount(amount, currency, rates);

  const yearIncome = months.reduce((s, m) => s + m.income, 0);
  const yearExpenses = months.reduce((s, m) => s + m.expenses, 0);
  const yearSavings = months.reduce((s, m) => s + m.savings, 0);
  const yearRemaining = yearIncome - yearExpenses - yearSavings;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{year}</CardTitle>
        <CardDescription>
          {months.length} {months.length === 1 ? "month" : "months"} of activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
              <TableHead className="text-right">Savings</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m) => {
              const remaining = m.income - m.expenses - m.savings;
              const isExpanded = expanded === m.month;

              return (
                <Fragment key={m.month}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpanded(isExpanded ? null : m.month)}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-1.5">
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180"
                          )}
                        />
                        {MONTH_NAMES[m.month]}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-green-600 dark:text-green-400">
                      {fmt(m.income)}
                    </TableCell>
                    <TableCell className="text-right text-red-600 dark:text-red-400">
                      {fmt(m.expenses)}
                    </TableCell>
                    <TableCell className="text-right text-blue-600 dark:text-blue-400">
                      {fmt(m.savings)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        remaining < 0 && "text-red-600 dark:text-red-400"
                      )}
                    >
                      {fmt(remaining)}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <TransactionDetail
                          transactions={m.transactions}
                          fmt={fmt}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                {fmt(yearIncome)}
              </TableCell>
              <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                {fmt(yearExpenses)}
              </TableCell>
              <TableCell className="text-right font-semibold text-blue-600 dark:text-blue-400">
                {fmt(yearSavings)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold",
                  yearRemaining < 0 && "text-red-600 dark:text-red-400"
                )}
              >
                {fmt(yearRemaining)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}

function TransactionDetail({
  transactions,
  fmt,
}: {
  transactions: MonthTransaction[];
  fmt: (amount: number) => string;
}) {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="border-t bg-muted/30 px-4 py-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="pb-2 text-left font-medium">Date</th>
            <th className="pb-2 text-left font-medium">Note</th>
            <th className="pb-2 text-left font-medium">Category</th>
            <th className="pb-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((tx) => {
            const date = new Date(tx.date);
            const formatted = date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
            const color = typeColor[tx.type] ?? "";
            const prefix = tx.type === "INCOME" ? "+" : "-";

            return (
              <tr key={tx.id} className="border-t border-border/50">
                <td className="py-1.5">{formatted}</td>
                <td className="py-1.5 text-muted-foreground">
                  {tx.note || "--"}
                </td>
                <td className="py-1.5">{tx.categoryName ?? "--"}</td>
                <td className={cn("py-1.5 text-right font-medium", color)}>
                  {prefix}{fmt(tx.amount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

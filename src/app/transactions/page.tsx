import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getTransactions, getOrCreateUserConfig, getTags, getRecurringTransactions } from "@/lib/actions";
import { fetchExchangeRates, type CurrencyCode } from "@/lib/currency";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";
import { TransactionFilters } from "@/components/transaction-filters";
import { RecurringTransactions } from "@/components/recurring-transactions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [transactions, config, rateData, tags, recurringRules] = await Promise.all([
    getTransactions(),
    getOrCreateUserConfig(),
    fetchExchangeRates(),
    getTags(),
    getRecurringTransactions(),
  ]);

  if (!config) redirect("/setup");

  const categories = config.activePlan.categories;
  const currency = (config.currency ?? "THB") as CurrencyCode;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Transactions
          </h1>
          <p className="text-muted-foreground">
            Track your daily income and spending.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/export-csv" download>
            <Button variant="outline">Export CSV</Button>
          </a>
          <AddTransactionDialog categories={categories} />
        </div>
      </div>

      <RecurringTransactions
        rules={recurringRules}
        categories={categories}
        currency={currency}
        rates={rateData.rates}
      />

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest income and expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionFilters
            transactions={transactions}
            categories={categories}
            tags={tags}
            currency={currency}
            rates={rateData.rates}
          />
        </CardContent>
      </Card>
    </div>
  );
}

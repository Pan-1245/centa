import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getTransactions, getOrCreateUserConfig } from "@/lib/actions";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";
import { TransactionTable } from "@/components/transaction-table";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const [transactions, config] = await Promise.all([
    getTransactions(),
    getOrCreateUserConfig(),
  ]);

  if (!config) redirect("/setup");

  const categories = config.activePlan.categories;

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
        <AddTransactionDialog categories={categories} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your latest income and expenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <TransactionTable transactions={transactions} />
        </CardContent>
      </Card>
    </div>
  );
}

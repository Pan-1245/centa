import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirect } from "next/navigation";
import { getDashboardStats } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  if (!stats) redirect("/setup");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your budget and spending.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Income</CardDescription>
            <CardTitle className="text-2xl text-green-600 dark:text-green-400">
              ${stats.totalIncome.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Expenses</CardDescription>
            <CardTitle className="text-2xl text-red-600 dark:text-red-400">
              ${stats.totalExpenses.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardDescription>Remaining</CardDescription>
            <CardTitle className="text-2xl">
              ${stats.remaining.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget Breakdown</CardTitle>
          <CardDescription>
            How your spending compares to your active plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No categories in your active plan.
            </p>
          ) : stats.totalIncome === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add income transactions to see your budget breakdown.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.breakdown.map((cat) => {
                const pct =
                  cat.budgeted > 0
                    ? Math.min(100, (cat.spent / cat.budgeted) * 100)
                    : 0;
                const over = cat.spent > cat.budgeted && cat.budgeted > 0;

                return (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {cat.name} ({cat.percentage}%)
                      </span>
                      <span className={over ? "text-red-600 dark:text-red-400" : ""}>
                        ${cat.spent.toFixed(2)} / ${cat.budgeted.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          over
                            ? "bg-red-500"
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
    </div>
  );
}

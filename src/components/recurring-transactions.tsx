"use client";

import { useState, useActionState } from "react";
import {
  createRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringTransaction,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Repeat } from "lucide-react";
import {
  formatAmount,
  type CurrencyCode,
  type ExchangeRates,
} from "@/lib/currency";

const typeColor: Record<string, string> = {
  INCOME: "text-green-600 dark:text-green-400",
  EXPENSE: "text-red-600 dark:text-red-400",
  SAVINGS: "text-blue-600 dark:text-blue-400",
};

type RecurringTx = {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "SAVINGS";
  note: string | null;
  dayOfMonth: number;
  isActive: boolean;
  category: { id: string; name: string } | null;
};

type Category = {
  id: string;
  name: string;
  isSavings: boolean;
};

export function RecurringTransactions({
  rules,
  categories,
  currency,
  rates,
}: {
  rules: RecurringTx[];
  categories: Category[];
  currency: CurrencyCode;
  rates: ExchangeRates;
}) {
  const fmt = (amount: number) => formatAmount(amount, currency, rates);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Recurring Transactions
            </CardTitle>
            <CardDescription>
              Auto-generated each month when the day arrives.
            </CardDescription>
          </div>
          <AddRecurringDialog categories={categories} />
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No recurring transactions yet.
          </p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const color = typeColor[rule.type] ?? "";
              const prefix = rule.type === "INCOME" ? "+" : "-";

              return (
                <div
                  key={rule.id}
                  className={`rounded-md border p-3 ${
                    !rule.isActive ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className={`font-medium ${color}`}>
                          {prefix}
                          {fmt(rule.amount)}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {rule.type}
                        </span>
                        {rule.category && (
                          <>
                            <span className="hidden sm:inline text-muted-foreground">
                              ·
                            </span>
                            <span className="hidden sm:inline">
                              {rule.category.name}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>Day {rule.dayOfMonth}</span>
                        {rule.category && (
                          <span className="sm:hidden">
                            · {rule.category.name}
                          </span>
                        )}
                        {rule.note && (
                          <>
                            <span>·</span>
                            <span className="truncate">{rule.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <form
                        action={async (formData: FormData) => {
                          await toggleRecurringTransaction(formData);
                        }}
                      >
                        <input type="hidden" name="id" value={rule.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 px-2"
                        >
                          {rule.isActive ? "Pause" : "Resume"}
                        </Button>
                      </form>
                      <form
                        action={async (formData: FormData) => {
                          await deleteRecurringTransaction(formData);
                        }}
                      >
                        <input type="hidden" name="id" value={rule.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddRecurringDialog({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const expenseCategories = categories.filter((c) => !c.isSavings);
  const savingsCategories = categories.filter((c) => c.isSavings);
  const visibleCategories =
    type === "SAVINGS" ? savingsCategories : expenseCategories;
  const needsCategory = type === "EXPENSE" || type === "SAVINGS";

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { success: boolean; error?: string } | null,
      formData: FormData,
    ) => {
      const result = await createRecurringTransaction(formData);
      if (result.success) {
        setOpen(false);
        setType("EXPENSE");
        setCategoryId("");
        setAmount("");
      }
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add Recurring
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Recurring Transaction</DialogTitle>
          <DialogDescription>
            This will auto-generate a transaction each month.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="amount" value={amount.replace(/,/g, "")} />

          <div className="space-y-2">
            <label htmlFor="rec-amount" className="text-sm font-medium">
              Amount (฿ THB)
            </label>
            <Input
              id="rec-amount"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, "");
                if (raw === "" || /^\d*\.?\d{0,2}$/.test(raw)) {
                  const parts = raw.split(".");
                  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                  setAmount(parts.join("."));
                }
              }}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                setCategoryId("");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="SAVINGS">Savings</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {needsCategory && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryId} onValueChange={setCategoryId} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {visibleCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="rec-day" className="text-sm font-medium">
              Day of Month (1-28)
            </label>
            <Input
              id="rec-day"
              name="dayOfMonth"
              type="number"
              min="1"
              max="28"
              placeholder="1"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="rec-note" className="text-sm font-medium">
              Note
            </label>
            <Input
              id="rec-note"
              name="note"
              placeholder="e.g. Monthly salary"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || (needsCategory && !categoryId)}
            >
              {pending ? "Creating..." : "Create Recurring"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

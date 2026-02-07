"use client";

import { useState, useActionState } from "react";
import { createSavingsGoal, deleteSavingsGoal } from "@/lib/actions";
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
import { Plus, Trash2, Target } from "lucide-react";
import {
  formatAmount,
  type CurrencyCode,
  type ExchangeRates,
} from "@/lib/currency";

type Goal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date | string | null;
  category: { id: string; name: string } | null;
};

type Category = {
  id: string;
  name: string;
  isSavings: boolean;
};

export function SavingsGoals({
  goals,
  savingsCategories,
  currency,
  rates,
}: {
  goals: Goal[];
  savingsCategories: Category[];
  currency: CurrencyCode;
  rates: ExchangeRates;
}) {
  const fmt = (amount: number) => formatAmount(amount, currency, rates);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Savings Goals</CardTitle>
            <CardDescription>
              Track progress toward your savings targets.
            </CardDescription>
          </div>
          <AddGoalDialog savingsCategories={savingsCategories} />
        </div>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No savings goals yet. Create one to start tracking.
          </p>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const pct =
                goal.targetAmount > 0
                  ? Math.min(
                      100,
                      (goal.currentAmount / goal.targetAmount) * 100,
                    )
                  : 0;
              const reached = goal.currentAmount >= goal.targetAmount;

              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-sm">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{goal.name}</span>
                      {goal.category && (
                        <span className="text-xs text-muted-foreground">
                          ({goal.category.name})
                        </span>
                      )}
                      {reached && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          Reached!
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-2 text-xs sm:text-sm">
                      <span className="text-muted-foreground sm:text-foreground">
                        {fmt(goal.currentAmount)} / {fmt(goal.targetAmount)}
                      </span>
                      <form
                        action={async (formData: FormData) => {
                          await deleteSavingsGoal(formData);
                        }}
                      >
                        <input type="hidden" name="id" value={goal.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${reached ? "bg-green-500" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {goal.deadline && (
                    <p className="text-xs text-muted-foreground">
                      Deadline:{" "}
                      {new Date(goal.deadline).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddGoalDialog({
  savingsCategories,
}: {
  savingsCategories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { success: boolean; error?: string } | null,
      formData: FormData,
    ) => {
      const result = await createSavingsGoal(formData);
      if (result.success) {
        setOpen(false);
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
          Add Goal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Savings Goal</DialogTitle>
          <DialogDescription>
            Set a target amount for your savings goal.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="categoryId" value={categoryId} />
          <input
            type="hidden"
            name="targetAmount"
            value={amount.replace(/,/g, "")}
          />

          <div className="space-y-2">
            <label htmlFor="goal-name" className="text-sm font-medium">
              Goal Name
            </label>
            <Input
              id="goal-name"
              name="name"
              placeholder="e.g. Emergency Fund"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="goal-amount" className="text-sm font-medium">
              Target Amount (฿ THB)
            </label>
            <Input
              id="goal-amount"
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

          {savingsCategories.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Linked Category</label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select savings category" />
                </SelectTrigger>
                <SelectContent>
                  {savingsCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="goal-deadline" className="text-sm font-medium">
              Deadline (optional)
            </label>
            <Input id="goal-deadline" name="deadline" type="date" />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create Goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

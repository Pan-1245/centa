"use client";

import { deleteTransaction } from "@/lib/actions";
import {
  formatAmount,
  type CurrencyCode,
  type ExchangeRates,
} from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";

type Transaction = {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "SAVINGS";
  note: string | null;
  date: Date | string;
  category: { id: string; name: string } | null;
  isRecurring?: boolean;
  tags?: { tag: { id: string; name: string } }[];
};

const typeColor = {
  INCOME: "text-green-600 dark:text-green-400",
  EXPENSE: "text-red-600 dark:text-red-400",
  SAVINGS: "text-blue-600 dark:text-blue-400",
};

const typeBgColor = {
  INCOME: "bg-green-100 dark:bg-green-900/30",
  EXPENSE: "bg-red-100 dark:bg-red-900/30",
  SAVINGS: "bg-blue-100 dark:bg-blue-900/30",
};

function DeleteButton({ id }: { id: string }) {
  return (
    <form
      action={async (formData: FormData) => {
        await deleteTransaction(formData);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </form>
  );
}

export function TransactionTable({
  transactions,
  currency,
  rates,
}: {
  transactions: Transaction[];
  currency: CurrencyCode;
  rates: ExchangeRates;
}) {
  const fmt = (amount: number) => formatAmount(amount, currency, rates);

  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        No transactions yet.
      </div>
    );
  }

  return (
    <>
      {/* Mobile card view */}
      <div className="space-y-3 sm:hidden">
        {transactions.map((tx) => {
          const date = new Date(tx.date);
          const formatted = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
          const color = typeColor[tx.type];
          const bgColor = typeBgColor[tx.type];
          const prefix = tx.type === "INCOME" ? "+" : "-";

          return (
            <div key={tx.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-semibold ${color}`}>
                      {prefix}
                      {fmt(tx.amount)}
                    </span>
                    {tx.isRecurring && (
                      <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Auto
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {tx.note || tx.category?.name || "--"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${color} ${bgColor}`}
                  >
                    {tx.type}
                  </span>
                  <DeleteButton id={tx.id} />
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{formatted}</span>
                <div className="flex items-center gap-2">
                  {tx.category && <span>{tx.category.name}</span>}
                  {tx.tags && tx.tags.length > 0 && (
                    <div className="flex gap-1">
                      {tx.tags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const date = new Date(tx.date);
              const formatted = date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const color = typeColor[tx.type];
              const prefix = tx.type === "INCOME" ? "+" : "-";

              return (
                <TableRow key={tx.id}>
                  <TableCell>{formatted}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.note || "--"}
                  </TableCell>
                  <TableCell>{tx.category?.name ?? "--"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {tx.tags?.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={color}>
                      {tx.type}
                      {tx.isRecurring && (
                        <span className="ml-1 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Auto
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={color}>
                      {prefix}
                      {fmt(tx.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DeleteButton id={tx.id} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

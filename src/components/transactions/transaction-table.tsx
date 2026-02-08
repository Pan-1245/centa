"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteTransaction } from "@/lib/actions/transactions";
import {
  formatAmount,
  type CurrencyCode,
  type ExchangeRates,
} from "@/lib/currency";

type Transaction = {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "SAVINGS";
  note: string | null;
  date: Date | string;
  category: { id: string; name: string } | null;
  isRecurring?: boolean;
  paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "OTHER" | null;
  paymentMethodNote?: string | null;
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

const paymentMethodLabel: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  TRANSFER: "Transfer",
  OTHER: "Other",
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
        className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
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
      <div className="text-muted-foreground py-8 text-center">
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
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-semibold ${color}`}>
                      {prefix}
                      {fmt(tx.amount)}
                    </span>
                    {tx.isRecurring && (
                      <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                        Auto
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground truncate text-sm">
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
              <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                <span>{formatted}</span>
                <div className="flex items-center gap-2">
                  {tx.paymentMethod && (
                    <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                      {tx.paymentMethodNote ||
                        paymentMethodLabel[tx.paymentMethod]}
                    </span>
                  )}
                  {tx.category && <span>{tx.category.name}</span>}
                  {tx.tags && tx.tags.length > 0 && (
                    <div className="flex gap-1">
                      {tx.tags.map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="bg-primary/10 text-primary inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
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
      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Method</TableHead>
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
                          className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tx.paymentMethod
                      ? tx.paymentMethodNote ||
                        paymentMethodLabel[tx.paymentMethod]
                      : "--"}
                  </TableCell>
                  <TableCell>
                    <span className={color}>
                      {tx.type}
                      {tx.isRecurring && (
                        <span className="bg-muted text-muted-foreground ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium">
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

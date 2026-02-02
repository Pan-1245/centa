"use client";

import { deleteTransaction } from "@/lib/actions";
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
  type: "INCOME" | "EXPENSE";
  note: string | null;
  date: Date | string;
  category: { id: string; name: string } | null;
};

export function TransactionTable({
  transactions,
}: {
  transactions: Transaction[];
}) {
  if (transactions.length === 0) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell
              colSpan={6}
              className="text-center text-muted-foreground"
            >
              No transactions yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Note</TableHead>
          <TableHead>Category</TableHead>
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
          const isIncome = tx.type === "INCOME";

          return (
            <TableRow key={tx.id}>
              <TableCell>{formatted}</TableCell>
              <TableCell className="text-muted-foreground">
                {tx.note || "--"}
              </TableCell>
              <TableCell>{tx.category?.name ?? "--"}</TableCell>
              <TableCell>
                <span
                  className={
                    isIncome
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {tx.type}
                </span>
              </TableCell>
              <TableCell className="text-right font-medium">
                <span
                  className={
                    isIncome
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }
                >
                  {isIncome ? "+" : "-"}${tx.amount.toFixed(2)}
                </span>
              </TableCell>
              <TableCell>
                <form action={async (formData: FormData) => { await deleteTransaction(formData); }}>
                  <input type="hidden" name="id" value={tx.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

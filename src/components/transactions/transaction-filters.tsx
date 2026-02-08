"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { TransactionTable } from "@/components/transactions/transaction-table";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CurrencyCode, ExchangeRates } from "@/lib/currency";

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

type Category = { id: string; name: string };
type Tag = { id: string; name: string };

export function TransactionFilters({
  transactions,
  categories,
  tags,
  currency,
  rates,
}: {
  transactions: Transaction[];
  categories: Category[];
  tags: Tag[];
  currency: CurrencyCode;
  rates: ExchangeRates;
}) {
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0, 0, 0, 0);
        if (txDate < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (txDate > to) return false;
      }
      if (typeFilter !== "ALL" && tx.type !== typeFilter) return false;
      if (categoryFilter !== "ALL" && tx.category?.id !== categoryFilter)
        return false;
      if (tagFilter !== "ALL" && !tx.tags?.some((t) => t.tag.id === tagFilter))
        return false;
      if (methodFilter !== "ALL" && tx.paymentMethod !== methodFilter)
        return false;
      return true;
    });
  }, [
    transactions,
    dateFrom,
    dateTo,
    typeFilter,
    categoryFilter,
    tagFilter,
    methodFilter,
  ]);

  const hasFilters =
    dateFrom ||
    dateTo ||
    typeFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    tagFilter !== "ALL" ||
    methodFilter !== "ALL";

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setTypeFilter("ALL");
    setCategoryFilter("ALL");
    setTagFilter("ALL");
    setMethodFilter("ALL");
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">
            From
          </label>
          <DatePicker
            value={dateFrom}
            onChange={setDateFrom}
            placeholder="Start date"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">
            To
          </label>
          <DatePicker
            value={dateTo}
            onChange={setDateTo}
            placeholder="End date"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">
            Type
          </label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-32.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem value="INCOME">Income</SelectItem>
              <SelectItem value="EXPENSE">Expense</SelectItem>
              <SelectItem value="SAVINGS">Savings</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">
            Category
          </label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-muted-foreground text-xs font-medium">
              Tag
            </label>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-full sm:w-35">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Tags</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-muted-foreground text-xs font-medium">
            Method
          </label>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="w-full sm:w-35">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Methods</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="CARD">Card</SelectItem>
              <SelectItem value="TRANSFER">Transfer</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="col-span-2 sm:col-span-1"
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {hasFilters && (
        <p className="text-muted-foreground text-xs">
          Showing {filtered.length} of {transactions.length} transactions
        </p>
      )}

      <TransactionTable
        transactions={filtered}
        currency={currency}
        rates={rates}
      />
    </div>
  );
}

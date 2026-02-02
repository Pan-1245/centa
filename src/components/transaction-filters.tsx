"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TransactionTable } from "@/components/transaction-table";
import { X } from "lucide-react";
import type { CurrencyCode, ExchangeRates } from "@/lib/currency";

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const txDate = new Date(tx.date);
      if (dateFrom && txDate < new Date(dateFrom)) return false;
      if (dateTo && txDate > new Date(dateTo + "T23:59:59")) return false;
      if (typeFilter !== "ALL" && tx.type !== typeFilter) return false;
      if (categoryFilter !== "ALL" && tx.category?.id !== categoryFilter) return false;
      if (tagFilter !== "ALL" && !tx.tags?.some((t) => t.tag.id === tagFilter)) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo, typeFilter, categoryFilter, tagFilter]);

  const hasFilters =
    dateFrom || dateTo || typeFilter !== "ALL" || categoryFilter !== "ALL" || tagFilter !== "ALL";

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setTypeFilter("ALL");
    setCategoryFilter("ALL");
    setTagFilter("ALL");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px]">
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
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Category</label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
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
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tag</label>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[140px]">
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
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {hasFilters && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {transactions.length} transactions
        </p>
      )}

      <TransactionTable transactions={filtered} currency={currency} rates={rates} />
    </div>
  );
}

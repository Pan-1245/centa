"use client";

import { useState, useActionState } from "react";
import { createTransaction } from "@/lib/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DatePicker } from "@/components/ui/date-picker";

type Category = {
  id: string;
  name: string;
  percentage: number;
  isSavings: boolean;
};

export function AddTransactionDialog({
  categories,
}: {
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("EXPENSE");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [tags, setTags] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentMethodNote, setPaymentMethodNote] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());

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
      const result = await createTransaction(formData);
      if (result.success) {
        setOpen(false);
        setType("EXPENSE");
        setCategoryId("");
        setAmount("");
        setTags("");
        setPaymentMethod("");
        setPaymentMethodNote("");
        setDate(new Date());
      }
      return result;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Transaction</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Record a new income, expense, or savings.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="paymentMethod" value={paymentMethod} />

          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount (฿ THB)
            </label>
            <input
              type="hidden"
              name="amount"
              value={amount.replace(/,/g, "")}
            />
            <Input
              id="amount"
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
                if (v !== "EXPENSE") {
                  setPaymentMethod("");
                  setPaymentMethodNote("");
                }
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
            <label htmlFor="note" className="text-sm font-medium">
              Note
            </label>
            <Input id="note" name="note" placeholder="Optional note" />
          </div>

          <div className="space-y-2">
            <label htmlFor="tags" className="text-sm font-medium">
              Tags
            </label>
            <Input
              id="tags"
              name="tags"
              placeholder="e.g. groceries, weekly (comma-separated)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          {type === "EXPENSE" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Payment Method</label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => {
                  setPaymentMethod(v);
                  if (v !== "OTHER") setPaymentMethodNote("");
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select method (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
              {paymentMethod === "OTHER" && (
                <Input
                  name="paymentMethodNote"
                  placeholder="e.g. PayPal, Crypto, Gift card"
                  value={paymentMethodNote}
                  onChange={(e) => setPaymentMethodNote(e.target.value)}
                />
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Date</label>
            <input
              type="hidden"
              name="date"
              value={date ? date.toISOString().split("T")[0] : ""}
            />
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="Pick a date"
            />
          </div>

          {state?.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || (needsCategory && !categoryId)}
            >
              {pending ? "Adding..." : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

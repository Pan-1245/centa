"use client";

import { useState, useActionState } from "react";
import { createTransaction } from "@/lib/actions";
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

type Category = {
  id: string;
  name: string;
  percentage: number;
};

export function AddTransactionDialog({
  categories,
}: {
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("EXPENSE");
  const [categoryId, setCategoryId] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const [state, formAction, pending] = useActionState(
    async (
      _prev: { success: boolean; error?: string } | null,
      formData: FormData
    ) => {
      const result = await createTransaction(formData);
      if (result.success) {
        setOpen(false);
        setType("EXPENSE");
        setCategoryId("");
      }
      return result;
    },
    null
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
            Record a new income or expense.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="categoryId" value={categoryId} />

          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-medium">
              Amount
            </label>
            <Input
              id="amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Type</label>
            <Select value={type} onValueChange={(v) => { setType(v); if (v === "INCOME") setCategoryId(""); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "EXPENSE" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={categoryId} onValueChange={setCategoryId} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
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
            <label htmlFor="date" className="text-sm font-medium">
              Date
            </label>
            <Input
              id="date"
              name="date"
              type="date"
              defaultValue={today}
              required
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending || (type === "EXPENSE" && !categoryId)}>
              {pending ? "Adding..." : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

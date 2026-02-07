"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TransactionType, PaymentMethod } from "@/generated/prisma/enums";

export async function getTransactions() {
  return prisma.transaction.findMany({
    include: { category: true, tags: { include: { tag: true } } },
    orderBy: { date: "desc" },
  });
}

export async function getTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" } });
}

export type MonthTransaction = {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE" | "SAVINGS";
  note: string | null;
  date: string;
  categoryName: string | null;
};

export type MonthSummary = {
  month: number;
  income: number;
  expenses: number;
  savings: number;
  transactions: MonthTransaction[];
};

export type YearSummary = {
  year: number;
  months: MonthSummary[];
};

export async function getMonthlySummary(): Promise<YearSummary[]> {
  const transactions = await prisma.transaction.findMany({
    include: { category: true },
    orderBy: { date: "asc" },
  });

  const map = new Map<
    string,
    {
      income: number;
      expenses: number;
      savings: number;
      transactions: MonthTransaction[];
    }
  >();

  for (const tx of transactions) {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const entry = map.get(key) ?? {
      income: 0,
      expenses: 0,
      savings: 0,
      transactions: [],
    };
    if (tx.type === "INCOME") {
      entry.income += tx.amount;
    } else if (tx.type === "SAVINGS") {
      entry.savings += tx.amount;
    } else {
      entry.expenses += tx.amount;
    }
    entry.transactions.push({
      id: tx.id,
      amount: tx.amount,
      type: tx.type,
      note: tx.note,
      date: tx.date.toISOString(),
      categoryName: tx.category?.name ?? null,
    });
    map.set(key, entry);
  }

  const yearMap = new Map<number, MonthSummary[]>();

  for (const [key, val] of map) {
    const [yearStr, monthStr] = key.split("-");
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const arr = yearMap.get(year) ?? [];
    arr.push({
      month,
      income: val.income,
      expenses: val.expenses,
      savings: val.savings,
      transactions: val.transactions,
    });
    yearMap.set(year, arr);
  }

  const result: YearSummary[] = [];

  for (const [year, months] of yearMap) {
    months.sort((a, b) => a.month - b.month);
    result.push({ year, months });
  }

  result.sort((a, b) => b.year - a.year);
  return result;
}

export async function createTransaction(formData: FormData) {
  const amount = formData.get("amount") as string;
  const type = formData.get("type") as string;
  const categoryId = formData.get("categoryId") as string;
  const note = formData.get("note") as string;
  const date = formData.get("date") as string;
  const tagsRaw = formData.get("tags") as string;
  const paymentMethodRaw = formData.get("paymentMethod") as string;
  const paymentMethodNoteRaw = formData.get("paymentMethodNote") as string;

  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return { success: false, error: "Amount must be a positive number." };
  }
  if (type !== "INCOME" && type !== "EXPENSE" && type !== "SAVINGS") {
    return {
      success: false,
      error: "Type must be INCOME, EXPENSE, or SAVINGS.",
    };
  }
  if ((type === "EXPENSE" || type === "SAVINGS") && !categoryId) {
    return {
      success: false,
      error: "Category is required for expenses and savings.",
    };
  }
  if (!date) {
    return { success: false, error: "Date is required." };
  }

  const validMethods: string[] = Object.values(PaymentMethod);
  const paymentMethod =
    paymentMethodRaw && validMethods.includes(paymentMethodRaw)
      ? (paymentMethodRaw as PaymentMethod)
      : null;
  const paymentMethodNote =
    paymentMethod === PaymentMethod.OTHER && paymentMethodNoteRaw?.trim()
      ? paymentMethodNoteRaw.trim()
      : null;

  try {
    let createdTx;
    if (type === "INCOME") {
      createdTx = await prisma.transaction.create({
        data: {
          amount: parseFloat(amount),
          type: TransactionType.INCOME,
          note: note || null,
          date: new Date(date),
          paymentMethod,
          paymentMethodNote,
        },
      });
    } else {
      createdTx = await prisma.transaction.create({
        data: {
          amount: parseFloat(amount),
          type:
            type === "SAVINGS"
              ? TransactionType.SAVINGS
              : TransactionType.EXPENSE,
          category: { connect: { id: categoryId } },
          note: note || null,
          date: new Date(date),
          paymentMethod,
          paymentMethodNote,
        },
      });
    }

    if (tagsRaw?.trim()) {
      const tagNames = tagsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      for (const tagName of tagNames) {
        const tag = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
        });
        await prisma.transactionTag.create({
          data: { transactionId: createdTx.id, tagId: tag.id },
        });
      }
    }

    revalidatePath("/");
    revalidatePath("/transactions");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create transaction." };
  }
}

export async function deleteTransaction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) {
    return { success: false, error: "Transaction ID is required." };
  }

  try {
    await prisma.transaction.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/transactions");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete transaction." };
  }
}

"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { TransactionType } from "@/generated/prisma/enums";

export async function getRecurringTransactions() {
  const user = await requireAuth();
  return prisma.recurringTransaction.findMany({
    where: { userId: user.id },
    include: { category: true },
    orderBy: { dayOfMonth: "asc" },
  });
}

export async function createRecurringTransaction(formData: FormData) {
  const user = await requireAuth();
  const amount = parseFloat(formData.get("amount") as string);
  const type = formData.get("type") as string;
  const categoryId = formData.get("categoryId") as string;
  const note = formData.get("note") as string;
  const dayOfMonth = parseInt(formData.get("dayOfMonth") as string, 10);

  if (isNaN(amount) || amount <= 0)
    return { success: false, error: "Amount must be positive." };
  if (!["INCOME", "EXPENSE", "SAVINGS"].includes(type))
    return { success: false, error: "Invalid type." };
  if ((type === "EXPENSE" || type === "SAVINGS") && !categoryId)
    return { success: false, error: "Category is required." };
  if (isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28)
    return { success: false, error: "Day must be 1-28." };

  if (categoryId) {
    const category = await prisma.budgetCategory.findFirst({
      where: { id: categoryId, plan: { userId: user.id } },
    });
    if (!category) {
      return { success: false, error: "Category not found." };
    }
  }

  try {
    await prisma.recurringTransaction.create({
      data: {
        amount,
        type: type as TransactionType,
        note: note || null,
        dayOfMonth,
        userId: user.id,
        categoryId: categoryId || null,
      },
    });
    revalidatePath("/");
    revalidatePath("/transactions");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create recurring transaction." };
  }
}

export async function deleteRecurringTransaction(formData: FormData) {
  const user = await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID is required." };

  try {
    await prisma.recurringTransaction.delete({
      where: { id, userId: user.id },
    });
    revalidatePath("/");
    revalidatePath("/transactions");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete recurring transaction." };
  }
}

export async function toggleRecurringTransaction(formData: FormData) {
  const user = await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID is required." };

  try {
    const rule = await prisma.recurringTransaction.findFirst({
      where: { id, userId: user.id },
    });
    if (!rule) return { success: false, error: "Not found." };

    await prisma.recurringTransaction.update({
      where: { id },
      data: { isActive: !rule.isActive },
    });
    revalidatePath("/");
    revalidatePath("/transactions");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to toggle recurring transaction." };
  }
}

export async function processRecurringTransactions() {
  const user = await requireAuth();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const activeRules = await prisma.recurringTransaction.findMany({
    where: { userId: user.id, isActive: true },
  });

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  for (const rule of activeRules) {
    const existing = await prisma.transaction.findFirst({
      where: {
        userId: user.id,
        recurringId: rule.id,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    if (existing) continue;

    if (now.getDate() >= rule.dayOfMonth) {
      const txDate = new Date(year, month, rule.dayOfMonth);
      await prisma.transaction.create({
        data: {
          amount: rule.amount,
          type: rule.type,
          note: rule.note,
          date: txDate,
          userId: user.id,
          categoryId: rule.categoryId,
          recurringId: rule.id,
          isRecurring: true,
        },
      });
    }
  }
}

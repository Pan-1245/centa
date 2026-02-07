"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { TransactionType } from "@/generated/prisma/enums";

export async function getSavingsGoals() {
  const goals = await prisma.savingsGoal.findMany({
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });

  const goalsWithProgress = await Promise.all(
    goals.map(async (goal) => {
      let currentAmount = 0;
      if (goal.categoryId) {
        const agg = await prisma.transaction.aggregate({
          where: { categoryId: goal.categoryId, type: TransactionType.SAVINGS },
          _sum: { amount: true },
        });
        currentAmount = agg._sum.amount ?? 0;
      }
      return { ...goal, currentAmount };
    }),
  );

  return goalsWithProgress;
}

export async function createSavingsGoal(formData: FormData) {
  const name = formData.get("name") as string;
  const targetAmount = parseFloat(formData.get("targetAmount") as string);
  const categoryId = formData.get("categoryId") as string;
  const deadline = formData.get("deadline") as string;

  if (!name?.trim()) return { success: false, error: "Name is required." };
  if (isNaN(targetAmount) || targetAmount <= 0)
    return { success: false, error: "Target must be a positive number." };

  try {
    await prisma.savingsGoal.create({
      data: {
        name,
        targetAmount,
        categoryId: categoryId || null,
        deadline: deadline ? new Date(deadline) : null,
      },
    });
    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create goal." };
  }
}

export async function deleteSavingsGoal(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "Goal ID is required." };

  try {
    await prisma.savingsGoal.delete({ where: { id } });
    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete goal." };
  }
}

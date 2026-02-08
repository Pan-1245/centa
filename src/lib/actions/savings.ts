"use server";

import { revalidatePath } from "next/cache";

import { TransactionType } from "@/generated/prisma/enums";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export async function getSavingsGoals() {
  const user = await requireAuth();
  const goals = await prisma.savingsGoal.findMany({
    where: { userId: user.id },
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });

  const goalsWithProgress = await Promise.all(
    goals.map(async (goal) => {
      let currentAmount = 0;
      if (goal.categoryId) {
        const agg = await prisma.transaction.aggregate({
          where: {
            userId: user.id,
            categoryId: goal.categoryId,
            type: TransactionType.SAVINGS,
          },
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
  const user = await requireAuth();
  const name = formData.get("name") as string;
  const targetAmount = parseFloat(formData.get("targetAmount") as string);
  const categoryId = formData.get("categoryId") as string;
  const deadline = formData.get("deadline") as string;

  if (!name?.trim()) return { success: false, error: "Name is required." };
  if (isNaN(targetAmount) || targetAmount <= 0)
    return { success: false, error: "Target must be a positive number." };

  if (categoryId) {
    const category = await prisma.budgetCategory.findFirst({
      where: { id: categoryId, plan: { userId: user.id } },
    });
    if (!category) {
      return { success: false, error: "Category not found." };
    }
  }

  try {
    await prisma.savingsGoal.create({
      data: {
        name,
        targetAmount,
        userId: user.id,
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
  const user = await requireAuth();
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "Goal ID is required." };

  try {
    await prisma.savingsGoal.delete({ where: { id, userId: user.id } });
    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete goal." };
  }
}

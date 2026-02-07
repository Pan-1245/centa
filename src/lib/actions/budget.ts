"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";
import { TransactionType } from "@/generated/prisma/enums";
import { getOrCreateUserConfig } from "@/lib/actions/config";

export async function getBudgetPlans() {
  const user = await requireAuth();
  return prisma.budgetPlan.findMany({
    where: { userId: user.id },
    include: { categories: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function setActiveBudgetPlan(formData: FormData) {
  const user = await requireAuth();
  const planId = formData.get("planId") as string;
  if (!planId) {
    return { success: false, error: "Plan ID is required." };
  }

  try {
    const config = await getOrCreateUserConfig();
    if (!config) {
      return { success: false, error: "No configuration found." };
    }

    // Verify the plan belongs to this user
    const plan = await prisma.budgetPlan.findFirst({
      where: { id: planId, userId: user.id },
    });
    if (!plan) {
      return { success: false, error: "Plan not found." };
    }

    await prisma.userConfig.update({
      where: { id: config.id },
      data: { activePlanId: planId },
    });

    revalidatePath("/");
    revalidatePath("/config");
    revalidatePath("/transactions");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update active plan." };
  }
}

export async function updateBudgetPlan(formData: FormData) {
  const user = await requireAuth();
  const planId = formData.get("planId") as string;
  const name = formData.get("name") as string;
  const categoriesJson = formData.get("categories") as string;

  if (!planId) {
    return { success: false, error: "Plan ID is required." };
  }
  if (!name?.trim()) {
    return { success: false, error: "Plan name is required." };
  }

  // Verify ownership
  const plan = await prisma.budgetPlan.findFirst({
    where: { id: planId, userId: user.id },
  });
  if (!plan) {
    return { success: false, error: "Plan not found." };
  }

  let categories: {
    id?: string;
    name: string;
    percentage: number;
    isSavings?: boolean;
  }[];
  try {
    categories = JSON.parse(categoriesJson);
  } catch {
    return { success: false, error: "Invalid categories data." };
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    return { success: false, error: "At least one category is required." };
  }

  const total = categories.reduce((sum, c) => sum + c.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    return { success: false, error: "Percentages must sum to 100." };
  }

  try {
    // Get existing categories for this plan
    const existingCategories = await prisma.budgetCategory.findMany({
      where: { planId },
    });
    const existingIds = new Set(existingCategories.map((c) => c.id));
    const submittedIds = new Set(
      categories.filter((c) => c.id).map((c) => c.id!),
    );

    // Find removed category IDs
    const removedIds = [...existingIds].filter((id) => !submittedIds.has(id));

    // Nullify categoryId on transactions for removed categories
    if (removedIds.length > 0) {
      await prisma.transaction.updateMany({
        where: { categoryId: { in: removedIds }, userId: user.id },
        data: { categoryId: null },
      });
      await prisma.budgetCategory.deleteMany({
        where: { id: { in: removedIds } },
      });
    }

    // Update existing categories and retype transactions when isSavings changes
    const existingMap = new Map(existingCategories.map((c) => [c.id, c]));
    for (const cat of categories.filter((c) => c.id)) {
      const prev = existingMap.get(cat.id!);
      const newIsSavings = cat.isSavings ?? false;
      await prisma.budgetCategory.update({
        where: { id: cat.id! },
        data: {
          name: cat.name,
          percentage: cat.percentage,
          isSavings: newIsSavings,
        },
      });
      // If isSavings changed, update transaction types for this category
      if (prev && prev.isSavings !== newIsSavings) {
        await prisma.transaction.updateMany({
          where: { categoryId: cat.id!, userId: user.id },
          data: {
            type: newIsSavings
              ? TransactionType.SAVINGS
              : TransactionType.EXPENSE,
          },
        });
      }
    }

    // Create new categories
    const newCategories = categories.filter((c) => !c.id);
    if (newCategories.length > 0) {
      await prisma.budgetCategory.createMany({
        data: newCategories.map((c) => ({
          name: c.name,
          percentage: c.percentage,
          isSavings: c.isSavings ?? false,
          planId,
        })),
      });
    }

    // Update plan name
    await prisma.budgetPlan.update({
      where: { id: planId },
      data: { name },
    });

    revalidatePath("/");
    revalidatePath("/config");
    revalidatePath("/transactions");
    return { success: true };
  } catch (e) {
    console.error("updateBudgetPlan error:", e);
    return { success: false, error: "Failed to update plan." };
  }
}

export async function createCustomPlan(formData: FormData) {
  const user = await requireAuth();
  const name = formData.get("name") as string;
  const categoriesJson = formData.get("categories") as string;

  if (!name?.trim()) {
    return { success: false, error: "Plan name is required." };
  }

  let categories: { name: string; percentage: number; isSavings?: boolean }[];
  try {
    categories = JSON.parse(categoriesJson);
  } catch {
    return { success: false, error: "Invalid categories data." };
  }

  if (!Array.isArray(categories) || categories.length === 0) {
    return { success: false, error: "At least one category is required." };
  }

  const total = categories.reduce((sum, c) => sum + c.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    return { success: false, error: "Percentages must sum to 100." };
  }

  try {
    await prisma.budgetPlan.create({
      data: {
        name,
        isCustom: true,
        userId: user.id,
        categories: {
          create: categories.map((c) => ({
            name: c.name,
            percentage: c.percentage,
            isSavings: c.isSavings ?? false,
          })),
        },
      },
    });

    revalidatePath("/config");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create custom plan." };
  }
}

export async function deleteBudgetPlan(formData: FormData) {
  const user = await requireAuth();
  const planId = formData.get("planId") as string;
  if (!planId) {
    return { success: false, error: "Plan ID is required." };
  }

  try {
    const config = await getOrCreateUserConfig();
    if (!config) {
      return { success: false, error: "No configuration found." };
    }
    if (config.activePlanId === planId) {
      return { success: false, error: "Cannot delete the active plan." };
    }

    const plan = await prisma.budgetPlan.findFirst({
      where: { id: planId, userId: user.id },
    });
    if (!plan) {
      return { success: false, error: "Plan not found." };
    }
    if (plan.isDefault) {
      return { success: false, error: "Cannot delete a default plan." };
    }

    const categories = await prisma.budgetCategory.findMany({
      where: { planId },
      select: { id: true },
    });
    const categoryIds = categories.map((c) => c.id);

    if (categoryIds.length > 0) {
      await prisma.transaction.updateMany({
        where: { categoryId: { in: categoryIds }, userId: user.id },
        data: { categoryId: null },
      });
    }

    await prisma.budgetPlan.deleteMany({
      where: { id: planId, userId: user.id },
    });

    revalidatePath("/config");
    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete plan." };
  }
}

"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TransactionType } from "@/generated/prisma/enums";

const defaultPlans = [
  {
    name: "50 / 30 / 20",
    isDefault: true,
    categories: [
      { name: "Needs", percentage: 50 },
      { name: "Wants", percentage: 30 },
      { name: "Savings", percentage: 20 },
    ],
  },
  {
    name: "70 / 20 / 10",
    isDefault: false,
    categories: [
      { name: "Essentials", percentage: 70 },
      { name: "Leisure", percentage: 20 },
      { name: "Savings", percentage: 10 },
    ],
  },
];

export async function getOrCreateUserConfig() {
  let config = await prisma.userConfig.findFirst({
    include: { activePlan: { include: { categories: true } } },
  });

  if (!config) {
    const defaultPlan = await prisma.budgetPlan.findFirst({
      where: { isDefault: true },
      include: { categories: true },
    });

    if (!defaultPlan) {
      return null;
    }

    config = await prisma.userConfig.create({
      data: { activePlanId: defaultPlan.id },
      include: { activePlan: { include: { categories: true } } },
    });
  }

  return config;
}

export async function initializeApp(formData: FormData) {
  const selectedIndex = parseInt(formData.get("planIndex") as string, 10);
  if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= defaultPlans.length) {
    return { success: false, error: "Invalid plan selection." };
  }

  const existing = await prisma.userConfig.findFirst();
  if (existing) {
    redirect("/");
  }

  const createdPlans = [];
  for (const plan of defaultPlans) {
    const created = await prisma.budgetPlan.create({
      data: {
        name: plan.name,
        isDefault: plan.isDefault,
        categories: { create: plan.categories },
      },
    });
    createdPlans.push(created);
  }

  await prisma.userConfig.create({
    data: { activePlanId: createdPlans[selectedIndex].id },
  });

  revalidatePath("/");
  redirect("/");
}

export async function initializeWithCustomPlan(formData: FormData) {
  const name = formData.get("name") as string;
  const categoriesJson = formData.get("categories") as string;

  if (!name?.trim()) {
    return { success: false, error: "Plan name is required." };
  }

  let categories: { name: string; percentage: number }[];
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

  const existing = await prisma.userConfig.findFirst();
  if (existing) {
    redirect("/");
  }

  const plan = await prisma.budgetPlan.create({
    data: {
      name,
      isCustom: true,
      categories: { create: categories },
    },
  });

  await prisma.userConfig.create({
    data: { activePlanId: plan.id },
  });

  revalidatePath("/");
  redirect("/");
}

export async function getBudgetPlans() {
  return prisma.budgetPlan.findMany({
    include: { categories: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getDashboardStats() {
  const config = await getOrCreateUserConfig();
  if (!config) return null;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const dateFilter = { gte: startOfMonth, lte: endOfMonth };

  const [incomeAgg, expenseAgg, expensesByCategory] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: TransactionType.INCOME, date: dateFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: TransactionType.EXPENSE, date: dateFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { type: TransactionType.EXPENSE, date: dateFilter },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = incomeAgg._sum.amount ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const remaining = totalIncome - totalExpenses;

  const spentByCategory = new Map(
    expensesByCategory.map((g) => [g.categoryId, g._sum.amount ?? 0])
  );

  const breakdown = config.activePlan.categories.map((cat) => ({
    name: cat.name,
    percentage: cat.percentage,
    budgeted: (cat.percentage / 100) * totalIncome,
    spent: spentByCategory.get(cat.id) ?? 0,
  }));

  return { totalIncome, totalExpenses, remaining, breakdown };
}

export async function getTransactions() {
  return prisma.transaction.findMany({
    include: { category: true },
    orderBy: { date: "desc" },
  });
}

export async function createTransaction(formData: FormData) {
  const amount = formData.get("amount") as string;
  const type = formData.get("type") as string;
  const categoryId = formData.get("categoryId") as string;
  const note = formData.get("note") as string;
  const date = formData.get("date") as string;

  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return { success: false, error: "Amount must be a positive number." };
  }
  if (type !== "INCOME" && type !== "EXPENSE") {
    return { success: false, error: "Type must be INCOME or EXPENSE." };
  }
  if (type === "EXPENSE" && !categoryId) {
    return { success: false, error: "Category is required for expenses." };
  }
  if (!date) {
    return { success: false, error: "Date is required." };
  }

  try {
    if (type === "EXPENSE") {
      await prisma.transaction.create({
        data: {
          amount: parseFloat(amount),
          type: TransactionType.EXPENSE,
          category: { connect: { id: categoryId } },
          note: note || null,
          date: new Date(date),
        },
      });
    } else {
      await prisma.transaction.create({
        data: {
          amount: parseFloat(amount),
          type: TransactionType.INCOME,
          note: note || null,
          date: new Date(date),
        },
      });
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

export async function setActiveBudgetPlan(formData: FormData) {
  const planId = formData.get("planId") as string;
  if (!planId) {
    return { success: false, error: "Plan ID is required." };
  }

  try {
    const config = await getOrCreateUserConfig();
    if (!config) {
      return { success: false, error: "No configuration found." };
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
  const planId = formData.get("planId") as string;
  const name = formData.get("name") as string;
  const categoriesJson = formData.get("categories") as string;

  if (!planId) {
    return { success: false, error: "Plan ID is required." };
  }
  if (!name?.trim()) {
    return { success: false, error: "Plan name is required." };
  }

  let categories: { id?: string; name: string; percentage: number }[];
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
    await prisma.$transaction(async (tx) => {
      // Get existing categories for this plan
      const existingCategories = await tx.budgetCategory.findMany({
        where: { planId },
      });
      const existingIds = new Set(existingCategories.map((c) => c.id));
      const submittedIds = new Set(
        categories.filter((c) => c.id).map((c) => c.id!)
      );

      // Find removed category IDs
      const removedIds = [...existingIds].filter((id) => !submittedIds.has(id));

      // Nullify categoryId on transactions for removed categories
      if (removedIds.length > 0) {
        await tx.transaction.updateMany({
          where: { categoryId: { in: removedIds } },
          data: { categoryId: null },
        });
        await tx.budgetCategory.deleteMany({
          where: { id: { in: removedIds } },
        });
      }

      // Update existing categories
      for (const cat of categories.filter((c) => c.id)) {
        await tx.budgetCategory.update({
          where: { id: cat.id! },
          data: { name: cat.name, percentage: cat.percentage },
        });
      }

      // Create new categories
      const newCategories = categories.filter((c) => !c.id);
      if (newCategories.length > 0) {
        await tx.budgetCategory.createMany({
          data: newCategories.map((c) => ({
            name: c.name,
            percentage: c.percentage,
            planId,
          })),
        });
      }

      // Update plan name
      await tx.budgetPlan.update({
        where: { id: planId },
        data: { name },
      });
    });

    revalidatePath("/");
    revalidatePath("/config");
    revalidatePath("/transactions");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update plan." };
  }
}

export async function createCustomPlan(formData: FormData) {
  const name = formData.get("name") as string;
  const categoriesJson = formData.get("categories") as string;

  if (!name?.trim()) {
    return { success: false, error: "Plan name is required." };
  }

  let categories: { name: string; percentage: number }[];
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
        categories: { create: categories },
      },
    });

    revalidatePath("/config");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to create custom plan." };
  }
}

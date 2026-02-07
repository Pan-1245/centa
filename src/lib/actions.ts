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
      { name: "Needs", percentage: 50, isSavings: false },
      { name: "Wants", percentage: 30, isSavings: false },
      { name: "Savings", percentage: 20, isSavings: true },
    ],
  },
  {
    name: "70 / 20 / 10",
    isDefault: false,
    categories: [
      { name: "Essentials", percentage: 70, isSavings: false },
      { name: "Leisure", percentage: 20, isSavings: false },
      { name: "Savings", percentage: 10, isSavings: true },
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
  if (
    isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= defaultPlans.length
  ) {
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

  const existing = await prisma.userConfig.findFirst();
  if (existing) {
    redirect("/");
  }

  const plan = await prisma.budgetPlan.create({
    data: {
      name,
      isCustom: true,
      categories: {
        create: categories.map((c) => ({
          name: c.name,
          percentage: c.percentage,
          isSavings: c.isSavings ?? false,
        })),
      },
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
    999,
  );

  const dateFilter = { gte: startOfMonth, lte: endOfMonth };

  const prevStartOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevEndOfMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
    999,
  );
  const prevDateFilter = { gte: prevStartOfMonth, lte: prevEndOfMonth };

  const [
    incomeAgg,
    expenseAgg,
    savingsAgg,
    spendByCategory,
    prevIncomeAgg,
    prevExpenseAgg,
    prevSavingsAgg,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: TransactionType.INCOME, date: dateFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: TransactionType.EXPENSE, date: dateFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: TransactionType.SAVINGS, date: dateFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        type: { in: [TransactionType.EXPENSE, TransactionType.SAVINGS] },
        date: dateFilter,
      },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: TransactionType.INCOME, date: prevDateFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: TransactionType.EXPENSE, date: prevDateFilter },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { type: TransactionType.SAVINGS, date: prevDateFilter },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = incomeAgg._sum.amount ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const totalSavings = savingsAgg._sum.amount ?? 0;
  const remaining = totalIncome - totalExpenses - totalSavings;

  const prevIncome = prevIncomeAgg._sum.amount ?? 0;
  const prevExpenses = prevExpenseAgg._sum.amount ?? 0;
  const prevSavings = prevSavingsAgg._sum.amount ?? 0;
  const prevRemaining = prevIncome - prevExpenses - prevSavings;

  const spentByCategory = new Map(
    spendByCategory.map((g) => [g.categoryId, g._sum.amount ?? 0]),
  );

  const breakdown = config.activePlan.categories.map((cat) => ({
    name: cat.name,
    percentage: cat.percentage,
    isSavings: cat.isSavings,
    budgeted: Math.floor((cat.percentage / 100) * totalIncome * 100) / 100,
    spent: spentByCategory.get(cat.id) ?? 0,
  }));

  return {
    totalIncome,
    totalExpenses,
    totalSavings,
    remaining,
    breakdown,
    prevIncome,
    prevExpenses,
    prevSavings,
    prevRemaining,
  };
}

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

  try {
    let createdTx;
    if (type === "INCOME") {
      createdTx = await prisma.transaction.create({
        data: {
          amount: parseFloat(amount),
          type: TransactionType.INCOME,
          note: note || null,
          date: new Date(date),
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

export async function updateCurrency(formData: FormData) {
  const currency = formData.get("currency") as string;
  if (!currency || !["THB", "USD", "JPY"].includes(currency)) {
    return { success: false, error: "Invalid currency." };
  }

  try {
    const config = await getOrCreateUserConfig();
    if (!config) {
      return { success: false, error: "No configuration found." };
    }
    await prisma.userConfig.update({
      where: { id: config.id },
      data: { currency },
    });

    revalidatePath("/");
    revalidatePath("/config");
    revalidatePath("/transactions");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update currency." };
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
        where: { categoryId: { in: removedIds } },
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
          where: { categoryId: cat.id! },
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

    const plan = await prisma.budgetPlan.findUnique({ where: { id: planId } });
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
        where: { categoryId: { in: categoryIds } },
        data: { categoryId: null },
      });
    }

    await prisma.budgetPlan.delete({ where: { id: planId } });

    revalidatePath("/config");
    revalidatePath("/");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete plan." };
  }
}

// --- Savings Goals ---

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

// --- Recurring Transactions ---

export async function getRecurringTransactions() {
  return prisma.recurringTransaction.findMany({
    include: { category: true },
    orderBy: { dayOfMonth: "asc" },
  });
}

export async function createRecurringTransaction(formData: FormData) {
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

  try {
    await prisma.recurringTransaction.create({
      data: {
        amount,
        type: type as TransactionType,
        note: note || null,
        dayOfMonth,
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
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID is required." };

  try {
    await prisma.recurringTransaction.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/transactions");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete recurring transaction." };
  }
}

export async function toggleRecurringTransaction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return { success: false, error: "ID is required." };

  try {
    const rule = await prisma.recurringTransaction.findUnique({
      where: { id },
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
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const activeRules = await prisma.recurringTransaction.findMany({
    where: { isActive: true },
  });

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  for (const rule of activeRules) {
    const existing = await prisma.transaction.findFirst({
      where: {
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
          categoryId: rule.categoryId,
          recurringId: rule.id,
          isRecurring: true,
        },
      });
    }
  }
}

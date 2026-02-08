"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { requireAuth } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

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
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  let config = await prisma.userConfig.findFirst({
    where: { userId },
    include: { activePlan: { include: { categories: true } } },
  });

  if (!config) {
    const defaultPlan = await prisma.budgetPlan.findFirst({
      where: { isDefault: true, userId },
      include: { categories: true },
    });

    if (!defaultPlan) {
      return null;
    }

    config = await prisma.userConfig.create({
      data: { userId, activePlanId: defaultPlan.id },
      include: { activePlan: { include: { categories: true } } },
    });
  }

  return config;
}

export async function initializeApp(formData: FormData) {
  const user = await requireAuth();
  const userId = user.id;

  const selectedIndex = parseInt(formData.get("planIndex") as string, 10);
  if (
    isNaN(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= defaultPlans.length
  ) {
    return { success: false, error: "Invalid plan selection." };
  }

  const existing = await prisma.userConfig.findFirst({ where: { userId } });
  if (existing) {
    redirect("/");
  }

  try {
    const createdPlans = [];
    for (const plan of defaultPlans) {
      const created = await prisma.budgetPlan.create({
        data: {
          name: plan.name,
          isDefault: plan.isDefault,
          userId,
          categories: { create: plan.categories },
        },
      });
      createdPlans.push(created);
    }

    await prisma.userConfig.create({
      data: { userId, activePlanId: createdPlans[selectedIndex].id },
    });
  } catch {
    // Race condition: another request already created the config
    redirect("/");
  }

  revalidatePath("/");
  redirect("/");
}

export async function initializeWithCustomPlan(formData: FormData) {
  const user = await requireAuth();
  const userId = user.id;

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

  const existing = await prisma.userConfig.findFirst({ where: { userId } });
  if (existing) {
    redirect("/");
  }

  try {
    const plan = await prisma.budgetPlan.create({
      data: {
        name,
        isCustom: true,
        userId,
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
      data: { userId, activePlanId: plan.id },
    });
  } catch {
    // Race condition: another request already created the config
    redirect("/");
  }

  revalidatePath("/");
  redirect("/");
}

export async function updateCurrency(formData: FormData) {
  const currency = formData.get("currency") as string;
  if (!currency || !["THB", "USD", "JPY"].includes(currency)) {
    return { success: false, error: "Invalid currency." };
  }

  try {
    const user = await requireAuth();
    const config = await prisma.userConfig.findFirst({
      where: { userId: user.id },
    });
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

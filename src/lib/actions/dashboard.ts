"use server";

import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/generated/prisma/enums";
import { getOrCreateUserConfig } from "@/lib/actions/config";

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

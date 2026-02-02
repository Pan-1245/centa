import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockPrisma = {
  userConfig: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  budgetPlan: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  budgetCategory: {
    findMany: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    updateMany: vi.fn(),
  },
  tag: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  transactionTag: {
    create: vi.fn(),
  },
  savingsGoal: {
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  recurringTransaction: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

class RedirectError extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectError(url);
  }),
}));

vi.mock("@/generated/prisma/enums", () => ({
  TransactionType: { INCOME: "INCOME", EXPENSE: "EXPENSE", SAVINGS: "SAVINGS" },
}));

// --- Helpers ---

function makeFormData(obj: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    fd.set(k, v);
  }
  return fd;
}

// --- Import actions after mocks ---

const {
  getOrCreateUserConfig,
  initializeApp,
  initializeWithCustomPlan,
  getBudgetPlans,
  getDashboardStats,
  getTransactions,
  getTags,
  getMonthlySummary,
  createTransaction,
  deleteTransaction,
  updateCurrency,
  setActiveBudgetPlan,
  updateBudgetPlan,
  createCustomPlan,
  deleteBudgetPlan,
  getSavingsGoals,
  createSavingsGoal,
  deleteSavingsGoal,
  getRecurringTransactions,
  createRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringTransaction,
  processRecurringTransactions,
} = await import("@/lib/actions");

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== getOrCreateUserConfig ====================

describe("getOrCreateUserConfig", () => {
  it("returns existing config when found", async () => {
    const config = { id: "c1", activePlanId: "p1", activePlan: { categories: [] } };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);

    const result = await getOrCreateUserConfig();
    expect(result).toEqual(config);
  });

  it("creates config from default plan when none exists", async () => {
    mockPrisma.userConfig.findFirst.mockResolvedValue(null);
    const defaultPlan = { id: "dp1", categories: [] };
    mockPrisma.budgetPlan.findFirst.mockResolvedValue(defaultPlan);
    const newConfig = { id: "c2", activePlanId: "dp1", activePlan: defaultPlan };
    mockPrisma.userConfig.create.mockResolvedValue(newConfig);

    const result = await getOrCreateUserConfig();
    expect(result).toEqual(newConfig);
    expect(mockPrisma.userConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { activePlanId: "dp1" } })
    );
  });

  it("returns null when no default plan exists", async () => {
    mockPrisma.userConfig.findFirst.mockResolvedValue(null);
    mockPrisma.budgetPlan.findFirst.mockResolvedValue(null);

    const result = await getOrCreateUserConfig();
    expect(result).toBeNull();
  });
});

// ==================== initializeApp ====================

describe("initializeApp", () => {
  it("rejects invalid planIndex", async () => {
    const result = await initializeApp(makeFormData({ planIndex: "99" }));
    expect(result).toEqual({ success: false, error: "Invalid plan selection." });
  });

  it("rejects non-numeric planIndex", async () => {
    const result = await initializeApp(makeFormData({ planIndex: "abc" }));
    expect(result).toEqual({ success: false, error: "Invalid plan selection." });
  });

  it("redirects if user config already exists", async () => {
    mockPrisma.userConfig.findFirst.mockResolvedValue({ id: "existing" });

    await expect(initializeApp(makeFormData({ planIndex: "0" }))).rejects.toThrow(
      RedirectError
    );
  });

  it("creates plans and config on valid input", async () => {
    mockPrisma.userConfig.findFirst.mockResolvedValue(null);
    mockPrisma.budgetPlan.create.mockResolvedValueOnce({ id: "p1" });
    mockPrisma.budgetPlan.create.mockResolvedValueOnce({ id: "p2" });
    mockPrisma.userConfig.create.mockResolvedValue({ id: "c1" });

    await expect(initializeApp(makeFormData({ planIndex: "0" }))).rejects.toThrow(
      RedirectError
    );
    expect(mockPrisma.budgetPlan.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.userConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { activePlanId: "p1" } })
    );
  });
});

// ==================== initializeWithCustomPlan ====================

describe("initializeWithCustomPlan", () => {
  it("rejects empty plan name", async () => {
    const result = await initializeWithCustomPlan(
      makeFormData({ name: "", categories: "[]" })
    );
    expect(result).toEqual({ success: false, error: "Plan name is required." });
  });

  it("rejects invalid JSON categories", async () => {
    const result = await initializeWithCustomPlan(
      makeFormData({ name: "Test", categories: "not-json" })
    );
    expect(result).toEqual({ success: false, error: "Invalid categories data." });
  });

  it("rejects empty categories array", async () => {
    const result = await initializeWithCustomPlan(
      makeFormData({ name: "Test", categories: "[]" })
    );
    expect(result).toEqual({
      success: false,
      error: "At least one category is required.",
    });
  });

  it("rejects percentages not summing to 100", async () => {
    const cats = JSON.stringify([{ name: "A", percentage: 50 }]);
    const result = await initializeWithCustomPlan(
      makeFormData({ name: "Test", categories: cats })
    );
    expect(result).toEqual({
      success: false,
      error: "Percentages must sum to 100.",
    });
  });

  it("creates plan and redirects on valid data", async () => {
    const cats = JSON.stringify([
      { name: "Needs", percentage: 60 },
      { name: "Wants", percentage: 40 },
    ]);
    mockPrisma.userConfig.findFirst.mockResolvedValue(null);
    mockPrisma.budgetPlan.create.mockResolvedValue({ id: "cp1" });
    mockPrisma.userConfig.create.mockResolvedValue({ id: "c1" });

    await expect(
      initializeWithCustomPlan(makeFormData({ name: "My Plan", categories: cats }))
    ).rejects.toThrow(RedirectError);
    expect(mockPrisma.budgetPlan.create).toHaveBeenCalled();
  });
});

// ==================== getBudgetPlans ====================

describe("getBudgetPlans", () => {
  it("returns all plans with categories", async () => {
    const plans = [{ id: "p1", name: "Test", categories: [] }];
    mockPrisma.budgetPlan.findMany.mockResolvedValue(plans);

    const result = await getBudgetPlans();
    expect(result).toEqual(plans);
  });
});

// ==================== getDashboardStats ====================

describe("getDashboardStats", () => {
  it("returns null when no config", async () => {
    mockPrisma.userConfig.findFirst.mockResolvedValue(null);
    mockPrisma.budgetPlan.findFirst.mockResolvedValue(null);

    const result = await getDashboardStats();
    expect(result).toBeNull();
  });

  it("computes stats correctly", async () => {
    const config = {
      id: "c1",
      activePlanId: "p1",
      activePlan: {
        categories: [
          { id: "cat1", name: "Needs", percentage: 50, isSavings: false },
          { id: "cat2", name: "Savings", percentage: 50, isSavings: true },
        ],
      },
    };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);

    // income, expense, savings, groupBy, prevIncome, prevExpense, prevSavings
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 10000 } }) // income
      .mockResolvedValueOnce({ _sum: { amount: 3000 } })  // expenses
      .mockResolvedValueOnce({ _sum: { amount: 2000 } })  // savings
      .mockResolvedValueOnce({ _sum: { amount: 8000 } })  // prev income
      .mockResolvedValueOnce({ _sum: { amount: 2500 } })  // prev expenses
      .mockResolvedValueOnce({ _sum: { amount: 1500 } }); // prev savings

    mockPrisma.transaction.groupBy.mockResolvedValue([
      { categoryId: "cat1", _sum: { amount: 3000 } },
    ]);

    const result = await getDashboardStats();
    expect(result!.totalIncome).toBe(10000);
    expect(result!.totalExpenses).toBe(3000);
    expect(result!.totalSavings).toBe(2000);
    expect(result!.remaining).toBe(5000); // 10000 - 3000 - 2000
    expect(result!.prevIncome).toBe(8000);
    expect(result!.prevExpenses).toBe(2500);
    expect(result!.prevSavings).toBe(1500);
    expect(result!.breakdown).toHaveLength(2);
    expect(result!.breakdown[0].spent).toBe(3000);
    expect(result!.breakdown[0].budgeted).toBe(5000); // 50% of 10000
  });
});

// ==================== getTransactions ====================

describe("getTransactions", () => {
  it("returns transactions with category and tags", async () => {
    const txs = [{ id: "t1", amount: 100, tags: [], category: null }];
    mockPrisma.transaction.findMany.mockResolvedValue(txs);

    const result = await getTransactions();
    expect(result).toEqual(txs);
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { category: true, tags: { include: { tag: true } } },
      })
    );
  });
});

// ==================== getTags ====================

describe("getTags", () => {
  it("returns tags sorted by name", async () => {
    const tags = [{ id: "t1", name: "food" }, { id: "t2", name: "transport" }];
    mockPrisma.tag.findMany.mockResolvedValue(tags);

    const result = await getTags();
    expect(result).toEqual(tags);
  });
});

// ==================== createTransaction ====================

describe("createTransaction", () => {
  it("rejects zero amount", async () => {
    const result = await createTransaction(
      makeFormData({ amount: "0", type: "INCOME", date: "2025-01-01", categoryId: "", tags: "" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", async () => {
    const result = await createTransaction(
      makeFormData({ amount: "-10", type: "INCOME", date: "2025-01-01", categoryId: "", tags: "" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", async () => {
    const result = await createTransaction(
      makeFormData({ amount: "100", type: "INVALID", date: "2025-01-01", categoryId: "", tags: "" })
    );
    expect(result).toEqual({ success: false, error: "Type must be INCOME, EXPENSE, or SAVINGS." });
  });

  it("rejects EXPENSE without category", async () => {
    const result = await createTransaction(
      makeFormData({ amount: "100", type: "EXPENSE", date: "2025-01-01", categoryId: "", tags: "" })
    );
    expect(result).toEqual({
      success: false,
      error: "Category is required for expenses and savings.",
    });
  });

  it("rejects SAVINGS without category", async () => {
    const result = await createTransaction(
      makeFormData({ amount: "100", type: "SAVINGS", date: "2025-01-01", categoryId: "", tags: "" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects missing date", async () => {
    const result = await createTransaction(
      makeFormData({ amount: "100", type: "INCOME", date: "", categoryId: "", tags: "" })
    );
    expect(result).toEqual({ success: false, error: "Date is required." });
  });

  it("creates INCOME transaction without category", async () => {
    mockPrisma.transaction.create.mockResolvedValue({ id: "tx1" });

    const result = await createTransaction(
      makeFormData({ amount: "5000", type: "INCOME", date: "2025-01-15", categoryId: "", note: "Salary", tags: "" })
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 5000,
          type: "INCOME",
          note: "Salary",
        }),
      })
    );
  });

  it("creates EXPENSE transaction with category", async () => {
    mockPrisma.transaction.create.mockResolvedValue({ id: "tx2" });

    const result = await createTransaction(
      makeFormData({
        amount: "200",
        type: "EXPENSE",
        date: "2025-01-15",
        categoryId: "cat1",
        note: "",
        tags: "",
      })
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 200,
          type: "EXPENSE",
          category: { connect: { id: "cat1" } },
        }),
      })
    );
  });

  it("creates SAVINGS transaction", async () => {
    mockPrisma.transaction.create.mockResolvedValue({ id: "tx3" });

    const result = await createTransaction(
      makeFormData({
        amount: "1000",
        type: "SAVINGS",
        date: "2025-01-15",
        categoryId: "cat2",
        tags: "",
      })
    );
    expect(result).toEqual({ success: true });
  });

  it("creates tags on transaction", async () => {
    mockPrisma.transaction.create.mockResolvedValue({ id: "tx4" });
    mockPrisma.tag.upsert.mockResolvedValueOnce({ id: "tag1", name: "food" });
    mockPrisma.tag.upsert.mockResolvedValueOnce({ id: "tag2", name: "weekly" });
    mockPrisma.transactionTag.create.mockResolvedValue({});

    const result = await createTransaction(
      makeFormData({
        amount: "100",
        type: "INCOME",
        date: "2025-01-15",
        categoryId: "",
        tags: "food, weekly",
      })
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.tag.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.transactionTag.create).toHaveBeenCalledTimes(2);
  });
});

// ==================== deleteTransaction ====================

describe("deleteTransaction", () => {
  it("deletes transaction", async () => {
    mockPrisma.transaction.delete.mockResolvedValue({});
    const result = await deleteTransaction(makeFormData({ id: "tx1" }));
    expect(result).toEqual({ success: true });
  });

  it("rejects missing ID", async () => {
    const result = await deleteTransaction(makeFormData({ id: "" }));
    expect(result).toEqual({ success: false, error: "Transaction ID is required." });
  });
});

// ==================== updateCurrency ====================

describe("updateCurrency", () => {
  it("updates to valid currency", async () => {
    const config = { id: "c1", activePlanId: "p1", activePlan: { categories: [] } };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);
    mockPrisma.userConfig.update.mockResolvedValue({});

    const result = await updateCurrency(makeFormData({ currency: "USD" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.userConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currency: "USD" } })
    );
  });

  it("rejects invalid currency", async () => {
    const result = await updateCurrency(makeFormData({ currency: "EUR" }));
    expect(result).toEqual({ success: false, error: "Invalid currency." });
  });

  it("rejects empty currency", async () => {
    const result = await updateCurrency(makeFormData({ currency: "" }));
    expect(result).toEqual({ success: false, error: "Invalid currency." });
  });
});

// ==================== setActiveBudgetPlan ====================

describe("setActiveBudgetPlan", () => {
  it("updates active plan", async () => {
    const config = { id: "c1", activePlanId: "p1", activePlan: { categories: [] } };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);
    mockPrisma.userConfig.update.mockResolvedValue({});

    const result = await setActiveBudgetPlan(makeFormData({ planId: "p2" }));
    expect(result).toEqual({ success: true });
  });

  it("rejects missing planId", async () => {
    const result = await setActiveBudgetPlan(makeFormData({ planId: "" }));
    expect(result).toEqual({ success: false, error: "Plan ID is required." });
  });
});

// ==================== updateBudgetPlan ====================

describe("updateBudgetPlan", () => {
  it("rejects missing plan name", async () => {
    const result = await updateBudgetPlan(
      makeFormData({ planId: "p1", name: "", categories: "[]" })
    );
    expect(result).toEqual({ success: false, error: "Plan name is required." });
  });

  it("rejects percentages != 100", async () => {
    const cats = JSON.stringify([{ id: "c1", name: "A", percentage: 50 }]);
    const result = await updateBudgetPlan(
      makeFormData({ planId: "p1", name: "Plan", categories: cats })
    );
    expect(result).toEqual({ success: false, error: "Percentages must sum to 100." });
  });

  it("updates plan and categories", async () => {
    const cats = JSON.stringify([
      { id: "cat1", name: "Needs", percentage: 60, isSavings: false },
      { id: "cat2", name: "Savings", percentage: 40, isSavings: true },
    ]);
    mockPrisma.budgetCategory.findMany.mockResolvedValue([
      { id: "cat1", isSavings: false },
      { id: "cat2", isSavings: false },
    ]);
    mockPrisma.budgetCategory.update.mockResolvedValue({});
    mockPrisma.transaction.updateMany.mockResolvedValue({});
    mockPrisma.budgetPlan.update.mockResolvedValue({});

    const result = await updateBudgetPlan(
      makeFormData({ planId: "p1", name: "Updated", categories: cats })
    );
    expect(result).toEqual({ success: true });
    // cat2 changed from isSavings=false to true, so transactions should be retyped
    expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoryId: "cat2" },
        data: { type: "SAVINGS" },
      })
    );
  });

  it("handles removed categories", async () => {
    const cats = JSON.stringify([{ id: "cat1", name: "Only", percentage: 100, isSavings: false }]);
    mockPrisma.budgetCategory.findMany.mockResolvedValue([
      { id: "cat1", isSavings: false },
      { id: "cat2", isSavings: false },
    ]);
    mockPrisma.transaction.updateMany.mockResolvedValue({});
    mockPrisma.budgetCategory.deleteMany.mockResolvedValue({});
    mockPrisma.budgetCategory.update.mockResolvedValue({});
    mockPrisma.budgetPlan.update.mockResolvedValue({});

    const result = await updateBudgetPlan(
      makeFormData({ planId: "p1", name: "Plan", categories: cats })
    );
    expect(result).toEqual({ success: true });
    // cat2 removed: transactions nullified, category deleted
    expect(mockPrisma.budgetCategory.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["cat2"] } } })
    );
  });
});

// ==================== createCustomPlan ====================

describe("createCustomPlan", () => {
  it("creates plan with valid data", async () => {
    const cats = JSON.stringify([
      { name: "A", percentage: 60, isSavings: false },
      { name: "B", percentage: 40, isSavings: true },
    ]);
    mockPrisma.budgetPlan.create.mockResolvedValue({ id: "cp1" });

    const result = await createCustomPlan(
      makeFormData({ name: "Custom", categories: cats })
    );
    expect(result).toEqual({ success: true });
  });

  it("rejects empty name", async () => {
    const result = await createCustomPlan(
      makeFormData({ name: "", categories: "[]" })
    );
    expect(result).toEqual({ success: false, error: "Plan name is required." });
  });
});

// ==================== deleteBudgetPlan ====================

describe("deleteBudgetPlan", () => {
  it("deletes non-active custom plan", async () => {
    const config = { id: "c1", activePlanId: "p1", activePlan: { categories: [] } };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);
    mockPrisma.budgetPlan.findUnique.mockResolvedValue({
      id: "p2",
      isDefault: false,
      isCustom: true,
    });
    mockPrisma.budgetCategory.findMany.mockResolvedValue([{ id: "cat1" }]);
    mockPrisma.transaction.updateMany.mockResolvedValue({});
    mockPrisma.budgetPlan.delete.mockResolvedValue({});

    const result = await deleteBudgetPlan(makeFormData({ planId: "p2" }));
    expect(result).toEqual({ success: true });
  });

  it("rejects deleting active plan", async () => {
    const config = { id: "c1", activePlanId: "p1", activePlan: { categories: [] } };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);

    const result = await deleteBudgetPlan(makeFormData({ planId: "p1" }));
    expect(result).toEqual({ success: false, error: "Cannot delete the active plan." });
  });

  it("rejects deleting default plan", async () => {
    const config = { id: "c1", activePlanId: "p1", activePlan: { categories: [] } };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);
    mockPrisma.budgetPlan.findUnique.mockResolvedValue({
      id: "p2",
      isDefault: true,
    });

    const result = await deleteBudgetPlan(makeFormData({ planId: "p2" }));
    expect(result).toEqual({ success: false, error: "Cannot delete a default plan." });
  });

  it("rejects missing planId", async () => {
    const result = await deleteBudgetPlan(makeFormData({ planId: "" }));
    expect(result).toEqual({ success: false, error: "Plan ID is required." });
  });
});

// ==================== getSavingsGoals ====================

describe("getSavingsGoals", () => {
  it("returns goals with computed currentAmount", async () => {
    mockPrisma.savingsGoal.findMany.mockResolvedValue([
      { id: "g1", name: "Emergency", targetAmount: 100000, categoryId: "cat1", category: { name: "Savings" } },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 25000 } });

    const result = await getSavingsGoals();
    expect(result).toHaveLength(1);
    expect(result[0].currentAmount).toBe(25000);
  });

  it("returns 0 currentAmount when no category linked", async () => {
    mockPrisma.savingsGoal.findMany.mockResolvedValue([
      { id: "g2", name: "Trip", targetAmount: 50000, categoryId: null, category: null },
    ]);

    const result = await getSavingsGoals();
    expect(result[0].currentAmount).toBe(0);
  });
});

// ==================== createSavingsGoal ====================

describe("createSavingsGoal", () => {
  it("creates goal with valid data", async () => {
    mockPrisma.savingsGoal.create.mockResolvedValue({ id: "g1" });

    const result = await createSavingsGoal(
      makeFormData({ name: "Emergency Fund", targetAmount: "100000", categoryId: "cat1", deadline: "2026-12-31" })
    );
    expect(result).toEqual({ success: true });
  });

  it("rejects empty name", async () => {
    const result = await createSavingsGoal(
      makeFormData({ name: "", targetAmount: "100", categoryId: "", deadline: "" })
    );
    expect(result).toEqual({ success: false, error: "Name is required." });
  });

  it("rejects non-positive target", async () => {
    const result = await createSavingsGoal(
      makeFormData({ name: "Test", targetAmount: "0", categoryId: "", deadline: "" })
    );
    expect(result).toEqual({ success: false, error: "Target must be a positive number." });
  });
});

// ==================== deleteSavingsGoal ====================

describe("deleteSavingsGoal", () => {
  it("deletes goal", async () => {
    mockPrisma.savingsGoal.delete.mockResolvedValue({});
    const result = await deleteSavingsGoal(makeFormData({ id: "g1" }));
    expect(result).toEqual({ success: true });
  });

  it("rejects missing ID", async () => {
    const result = await deleteSavingsGoal(makeFormData({ id: "" }));
    expect(result).toEqual({ success: false, error: "Goal ID is required." });
  });
});

// ==================== getRecurringTransactions ====================

describe("getRecurringTransactions", () => {
  it("returns all rules with categories", async () => {
    const rules = [{ id: "r1", amount: 1000, dayOfMonth: 1, category: null }];
    mockPrisma.recurringTransaction.findMany.mockResolvedValue(rules);

    const result = await getRecurringTransactions();
    expect(result).toEqual(rules);
  });
});

// ==================== createRecurringTransaction ====================

describe("createRecurringTransaction", () => {
  it("creates rule with valid data", async () => {
    mockPrisma.recurringTransaction.create.mockResolvedValue({ id: "r1" });

    const result = await createRecurringTransaction(
      makeFormData({ amount: "5000", type: "INCOME", categoryId: "", note: "Salary", dayOfMonth: "25" })
    );
    expect(result).toEqual({ success: true });
  });

  it("rejects non-positive amount", async () => {
    const result = await createRecurringTransaction(
      makeFormData({ amount: "0", type: "INCOME", categoryId: "", dayOfMonth: "1" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects dayOfMonth > 28", async () => {
    const result = await createRecurringTransaction(
      makeFormData({ amount: "100", type: "INCOME", categoryId: "", dayOfMonth: "31" })
    );
    expect(result).toEqual({ success: false, error: "Day must be 1-28." });
  });

  it("rejects dayOfMonth < 1", async () => {
    const result = await createRecurringTransaction(
      makeFormData({ amount: "100", type: "INCOME", categoryId: "", dayOfMonth: "0" })
    );
    expect(result).toEqual({ success: false, error: "Day must be 1-28." });
  });

  it("rejects EXPENSE without category", async () => {
    const result = await createRecurringTransaction(
      makeFormData({ amount: "100", type: "EXPENSE", categoryId: "", dayOfMonth: "15" })
    );
    expect(result).toEqual({ success: false, error: "Category is required." });
  });
});

// ==================== deleteRecurringTransaction ====================

describe("deleteRecurringTransaction", () => {
  it("deletes rule", async () => {
    mockPrisma.recurringTransaction.delete.mockResolvedValue({});
    const result = await deleteRecurringTransaction(makeFormData({ id: "r1" }));
    expect(result).toEqual({ success: true });
  });

  it("rejects missing ID", async () => {
    const result = await deleteRecurringTransaction(makeFormData({ id: "" }));
    expect(result).toEqual({ success: false, error: "ID is required." });
  });
});

// ==================== toggleRecurringTransaction ====================

describe("toggleRecurringTransaction", () => {
  it("toggles from active to inactive", async () => {
    mockPrisma.recurringTransaction.findUnique.mockResolvedValue({ id: "r1", isActive: true });
    mockPrisma.recurringTransaction.update.mockResolvedValue({});

    const result = await toggleRecurringTransaction(makeFormData({ id: "r1" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.recurringTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    );
  });

  it("toggles from inactive to active", async () => {
    mockPrisma.recurringTransaction.findUnique.mockResolvedValue({ id: "r1", isActive: false });
    mockPrisma.recurringTransaction.update.mockResolvedValue({});

    const result = await toggleRecurringTransaction(makeFormData({ id: "r1" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.recurringTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } })
    );
  });

  it("rejects missing ID", async () => {
    const result = await toggleRecurringTransaction(makeFormData({ id: "" }));
    expect(result).toEqual({ success: false, error: "ID is required." });
  });
});

// ==================== processRecurringTransactions ====================

describe("processRecurringTransactions", () => {
  it("creates transaction when day has passed", async () => {
    const now = new Date();
    mockPrisma.recurringTransaction.findMany.mockResolvedValue([
      { id: "r1", amount: 5000, type: "INCOME", note: "Salary", dayOfMonth: 1, categoryId: null },
    ]);
    mockPrisma.transaction.findFirst.mockResolvedValue(null); // no existing
    mockPrisma.transaction.create.mockResolvedValue({ id: "auto1" });

    await processRecurringTransactions();

    if (now.getDate() >= 1) {
      expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 5000,
            type: "INCOME",
            isRecurring: true,
            recurringId: "r1",
          }),
        })
      );
    }
  });

  it("skips when transaction already exists for this month", async () => {
    mockPrisma.recurringTransaction.findMany.mockResolvedValue([
      { id: "r1", amount: 5000, type: "INCOME", note: null, dayOfMonth: 1, categoryId: null },
    ]);
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: "existing" });

    await processRecurringTransactions();
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
  });

  it("skips inactive rules", async () => {
    // findMany with isActive: true filter means inactive won't be returned
    mockPrisma.recurringTransaction.findMany.mockResolvedValue([]);

    await processRecurringTransactions();
    expect(mockPrisma.transaction.findFirst).not.toHaveBeenCalled();
  });
});

// ==================== getMonthlySummary ====================

describe("getMonthlySummary", () => {
  it("groups transactions by year and month", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: "t1", amount: 5000, type: "INCOME", note: null,
        date: new Date("2025-01-15"), category: null, categoryId: null,
      },
      {
        id: "t2", amount: 2000, type: "EXPENSE", note: "Rent",
        date: new Date("2025-01-20"), category: { name: "Needs" }, categoryId: "c1",
      },
      {
        id: "t3", amount: 1000, type: "SAVINGS", note: null,
        date: new Date("2025-02-01"), category: { name: "Savings" }, categoryId: "c2",
      },
    ]);

    const result = await getMonthlySummary();
    expect(result).toHaveLength(1); // 1 year
    expect(result[0].year).toBe(2025);
    expect(result[0].months).toHaveLength(2); // Jan and Feb

    const jan = result[0].months.find((m) => m.month === 0);
    expect(jan!.income).toBe(5000);
    expect(jan!.expenses).toBe(2000);

    const feb = result[0].months.find((m) => m.month === 1);
    expect(feb!.savings).toBe(1000);
  });

  it("returns empty array when no transactions", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const result = await getMonthlySummary();
    expect(result).toEqual([]);
  });
});

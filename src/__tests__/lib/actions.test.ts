import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Auth mock ---

const TEST_USER = {
  id: "test-user-id",
  name: "Test User",
  email: "test@test.com",
};

vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: TEST_USER }),
}));

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn().mockResolvedValue(TEST_USER),
}));

// --- Prisma mock ---

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
    deleteMany: vi.fn(),
  },
  budgetCategory: {
    findFirst: vi.fn(),
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
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  recurringTransaction: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
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

vi.mock("bcryptjs", () => ({
  default: {
    hash: vi.fn().mockResolvedValue("hashed-password"),
    compare: vi.fn(),
  },
}));

vi.mock("@/generated/prisma/enums", () => ({
  TransactionType: { INCOME: "INCOME", EXPENSE: "EXPENSE", SAVINGS: "SAVINGS" },
  PaymentMethod: {
    CASH: "CASH",
    CARD: "CARD",
    TRANSFER: "TRANSFER",
    OTHER: "OTHER",
  },
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
  updateCurrency,
} = await import("@/lib/actions/config");
const {
  getBudgetPlans,
  setActiveBudgetPlan,
  updateBudgetPlan,
  createCustomPlan,
  deleteBudgetPlan,
} = await import("@/lib/actions/budget");
const {
  getTransactions,
  getTags,
  getMonthlySummary,
  createTransaction,
  deleteTransaction,
} = await import("@/lib/actions/transactions");
const { getDashboardStats } = await import("@/lib/actions/dashboard");
const { getSavingsGoals, createSavingsGoal, deleteSavingsGoal } =
  await import("@/lib/actions/savings");
const {
  getRecurringTransactions,
  createRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringTransaction,
  processRecurringTransactions,
} = await import("@/lib/actions/recurring");
const { registerUser } = await import("@/lib/actions/auth");

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== getOrCreateUserConfig ====================

describe("getOrCreateUserConfig", () => {
  it("returns existing config when found", async () => {
    const config = {
      id: "c1",
      userId: TEST_USER.id,
      activePlanId: "p1",
      activePlan: { categories: [] },
    };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);

    const result = await getOrCreateUserConfig();
    expect(result).toEqual(config);
    expect(mockPrisma.userConfig.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
      }),
    );
  });

  it("creates config from default plan when none exists", async () => {
    mockPrisma.userConfig.findFirst.mockResolvedValue(null);
    const defaultPlan = { id: "dp1", categories: [] };
    mockPrisma.budgetPlan.findFirst.mockResolvedValue(defaultPlan);
    const newConfig = {
      id: "c2",
      userId: TEST_USER.id,
      activePlanId: "dp1",
      activePlan: defaultPlan,
    };
    mockPrisma.userConfig.create.mockResolvedValue(newConfig);

    const result = await getOrCreateUserConfig();
    expect(result).toEqual(newConfig);
    expect(mockPrisma.userConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: TEST_USER.id, activePlanId: "dp1" },
      }),
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
    expect(result).toEqual({
      success: false,
      error: "Invalid plan selection.",
    });
  });

  it("rejects non-numeric planIndex", async () => {
    const result = await initializeApp(makeFormData({ planIndex: "abc" }));
    expect(result).toEqual({
      success: false,
      error: "Invalid plan selection.",
    });
  });

  it("redirects if user config already exists", async () => {
    mockPrisma.userConfig.findFirst.mockResolvedValue({ id: "existing" });

    await expect(
      initializeApp(makeFormData({ planIndex: "0" })),
    ).rejects.toThrow(RedirectError);
  });

  it("creates plans and config with userId on valid input", async () => {
    mockPrisma.userConfig.findFirst.mockResolvedValue(null);
    mockPrisma.budgetPlan.create.mockResolvedValueOnce({ id: "p1" });
    mockPrisma.budgetPlan.create.mockResolvedValueOnce({ id: "p2" });
    mockPrisma.userConfig.create.mockResolvedValue({ id: "c1" });

    await expect(
      initializeApp(makeFormData({ planIndex: "0" })),
    ).rejects.toThrow(RedirectError);
    expect(mockPrisma.budgetPlan.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.budgetPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: TEST_USER.id }),
      }),
    );
    expect(mockPrisma.userConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { userId: TEST_USER.id, activePlanId: "p1" },
      }),
    );
  });
});

// ==================== initializeWithCustomPlan ====================

describe("initializeWithCustomPlan", () => {
  it("rejects empty plan name", async () => {
    const result = await initializeWithCustomPlan(
      makeFormData({ name: "", categories: "[]" }),
    );
    expect(result).toEqual({ success: false, error: "Plan name is required." });
  });

  it("rejects invalid JSON categories", async () => {
    const result = await initializeWithCustomPlan(
      makeFormData({ name: "Test", categories: "not-json" }),
    );
    expect(result).toEqual({
      success: false,
      error: "Invalid categories data.",
    });
  });

  it("rejects empty categories array", async () => {
    const result = await initializeWithCustomPlan(
      makeFormData({ name: "Test", categories: "[]" }),
    );
    expect(result).toEqual({
      success: false,
      error: "At least one category is required.",
    });
  });

  it("rejects percentages not summing to 100", async () => {
    const cats = JSON.stringify([{ name: "A", percentage: 50 }]);
    const result = await initializeWithCustomPlan(
      makeFormData({ name: "Test", categories: cats }),
    );
    expect(result).toEqual({
      success: false,
      error: "Percentages must sum to 100.",
    });
  });

  it("creates plan with userId and redirects on valid data", async () => {
    const cats = JSON.stringify([
      { name: "Needs", percentage: 60 },
      { name: "Wants", percentage: 40 },
    ]);
    mockPrisma.userConfig.findFirst.mockResolvedValue(null);
    mockPrisma.budgetPlan.create.mockResolvedValue({ id: "cp1" });
    mockPrisma.userConfig.create.mockResolvedValue({ id: "c1" });

    await expect(
      initializeWithCustomPlan(
        makeFormData({ name: "My Plan", categories: cats }),
      ),
    ).rejects.toThrow(RedirectError);
    expect(mockPrisma.budgetPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: TEST_USER.id }),
      }),
    );
  });
});

// ==================== getBudgetPlans ====================

describe("getBudgetPlans", () => {
  it("returns plans filtered by userId", async () => {
    const plans = [{ id: "p1", name: "Test", categories: [] }];
    mockPrisma.budgetPlan.findMany.mockResolvedValue(plans);

    const result = await getBudgetPlans();
    expect(result).toEqual(plans);
    expect(mockPrisma.budgetPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
      }),
    );
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

  it("computes stats correctly with userId filtering", async () => {
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
      .mockResolvedValueOnce({ _sum: { amount: 3000 } }) // expenses
      .mockResolvedValueOnce({ _sum: { amount: 2000 } }) // savings
      .mockResolvedValueOnce({ _sum: { amount: 8000 } }) // prev income
      .mockResolvedValueOnce({ _sum: { amount: 2500 } }) // prev expenses
      .mockResolvedValueOnce({ _sum: { amount: 1500 } }); // prev savings

    mockPrisma.transaction.groupBy.mockResolvedValue([
      { categoryId: "cat1", _sum: { amount: 3000 } },
    ]);

    const result = await getDashboardStats();
    expect(result!.totalIncome).toBe(10000);
    expect(result!.totalExpenses).toBe(3000);
    expect(result!.totalSavings).toBe(2000);
    expect(result!.remaining).toBe(5000); // 10000 - 3000 - 2000

    // Verify userId is passed in aggregate queries
    expect(mockPrisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: TEST_USER.id }),
      }),
    );
  });

  it("uses Math.round for budget calculation", async () => {
    const config = {
      id: "c1",
      activePlanId: "p1",
      activePlan: {
        categories: [
          { id: "cat1", name: "Needs", percentage: 33.33, isSavings: false },
          { id: "cat2", name: "Wants", percentage: 66.67, isSavings: false },
        ],
      },
    };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);

    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 1000 } }) // income
      .mockResolvedValueOnce({ _sum: { amount: 0 } }) // expenses
      .mockResolvedValueOnce({ _sum: { amount: 0 } }) // savings
      .mockResolvedValueOnce({ _sum: { amount: 0 } }) // prev income
      .mockResolvedValueOnce({ _sum: { amount: 0 } }) // prev expenses
      .mockResolvedValueOnce({ _sum: { amount: 0 } }); // prev savings

    mockPrisma.transaction.groupBy.mockResolvedValue([]);

    const result = await getDashboardStats();
    // Math.round(33.33/100 * 1000 * 100) / 100 = Math.round(33330) / 100 = 333.30
    expect(result!.breakdown[0].budgeted).toBe(333.3);
    // Math.round(66.67/100 * 1000 * 100) / 100 = Math.round(66670) / 100 = 666.70
    expect(result!.breakdown[1].budgeted).toBe(666.7);
  });
});

// ==================== getTransactions ====================

describe("getTransactions", () => {
  it("returns transactions filtered by userId, sorted by date then createdAt", async () => {
    const txs = [{ id: "t1", amount: 100, tags: [], category: null }];
    mockPrisma.transaction.findMany.mockResolvedValue(txs);

    const result = await getTransactions();
    expect(result).toEqual(txs);
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
        include: { category: true, tags: { include: { tag: true } } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      }),
    );
  });
});

// ==================== getTags ====================

describe("getTags", () => {
  it("returns tags filtered by userId", async () => {
    const tags = [
      { id: "t1", name: "food" },
      { id: "t2", name: "transport" },
    ];
    mockPrisma.tag.findMany.mockResolvedValue(tags);

    const result = await getTags();
    expect(result).toEqual(tags);
    expect(mockPrisma.tag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
      }),
    );
  });
});

// ==================== createTransaction ====================

describe("createTransaction", () => {
  it("rejects zero amount", async () => {
    const result = await createTransaction(
      makeFormData({
        amount: "0",
        type: "INCOME",
        date: "2025-01-01",
        categoryId: "",
        tags: "",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", async () => {
    const result = await createTransaction(
      makeFormData({
        amount: "-10",
        type: "INCOME",
        date: "2025-01-01",
        categoryId: "",
        tags: "",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", async () => {
    const result = await createTransaction(
      makeFormData({
        amount: "100",
        type: "INVALID",
        date: "2025-01-01",
        categoryId: "",
        tags: "",
      }),
    );
    expect(result).toEqual({
      success: false,
      error: "Type must be INCOME, EXPENSE, or SAVINGS.",
    });
  });

  it("rejects EXPENSE without category", async () => {
    const result = await createTransaction(
      makeFormData({
        amount: "100",
        type: "EXPENSE",
        date: "2025-01-01",
        categoryId: "",
        tags: "",
      }),
    );
    expect(result).toEqual({
      success: false,
      error: "Category is required for expenses and savings.",
    });
  });

  it("rejects SAVINGS without category", async () => {
    const result = await createTransaction(
      makeFormData({
        amount: "100",
        type: "SAVINGS",
        date: "2025-01-01",
        categoryId: "",
        tags: "",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects missing date", async () => {
    const result = await createTransaction(
      makeFormData({
        amount: "100",
        type: "INCOME",
        date: "",
        categoryId: "",
        tags: "",
      }),
    );
    expect(result).toEqual({ success: false, error: "Date is required." });
  });

  it("creates INCOME transaction with userId", async () => {
    mockPrisma.transaction.create.mockResolvedValue({ id: "tx1" });

    const result = await createTransaction(
      makeFormData({
        amount: "5000",
        type: "INCOME",
        date: "2025-01-15",
        categoryId: "",
        note: "Salary",
        tags: "",
      }),
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 5000,
          type: "INCOME",
          note: "Salary",
          userId: TEST_USER.id,
        }),
      }),
    );
  });

  it("rejects categoryId not owned by user", async () => {
    mockPrisma.budgetCategory.findFirst.mockResolvedValue(null);

    const result = await createTransaction(
      makeFormData({
        amount: "200",
        type: "EXPENSE",
        date: "2025-01-15",
        categoryId: "other-user-cat",
        tags: "",
      }),
    );
    expect(result).toEqual({ success: false, error: "Category not found." });
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
  });

  it("creates EXPENSE transaction with category and userId", async () => {
    mockPrisma.budgetCategory.findFirst.mockResolvedValue({ id: "cat1" });
    mockPrisma.transaction.create.mockResolvedValue({ id: "tx2" });

    const result = await createTransaction(
      makeFormData({
        amount: "200",
        type: "EXPENSE",
        date: "2025-01-15",
        categoryId: "cat1",
        note: "",
        tags: "",
      }),
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 200,
          type: "EXPENSE",
          categoryId: "cat1",
          userId: TEST_USER.id,
        }),
      }),
    );
  });

  it("creates SAVINGS transaction", async () => {
    mockPrisma.budgetCategory.findFirst.mockResolvedValue({ id: "cat2" });
    mockPrisma.transaction.create.mockResolvedValue({ id: "tx3" });

    const result = await createTransaction(
      makeFormData({
        amount: "1000",
        type: "SAVINGS",
        date: "2025-01-15",
        categoryId: "cat2",
        tags: "",
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it("creates tags with userId composite key", async () => {
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
      }),
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.tag.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.tag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name_userId: { name: "food", userId: TEST_USER.id } },
        create: { name: "food", userId: TEST_USER.id },
      }),
    );
    expect(mockPrisma.transactionTag.create).toHaveBeenCalledTimes(2);
  });
});

// ==================== deleteTransaction ====================

describe("deleteTransaction", () => {
  it("deletes transaction with userId ownership check", async () => {
    mockPrisma.transaction.delete.mockResolvedValue({});
    const result = await deleteTransaction(makeFormData({ id: "tx1" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({
      where: { id: "tx1", userId: TEST_USER.id },
    });
  });

  it("rejects missing ID", async () => {
    const result = await deleteTransaction(makeFormData({ id: "" }));
    expect(result).toEqual({
      success: false,
      error: "Transaction ID is required.",
    });
  });
});

// ==================== updateCurrency ====================

describe("updateCurrency", () => {
  it("updates to valid currency", async () => {
    const config = {
      id: "c1",
      userId: TEST_USER.id,
      activePlanId: "p1",
      activePlan: { categories: [] },
    };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);
    mockPrisma.userConfig.update.mockResolvedValue({});

    const result = await updateCurrency(makeFormData({ currency: "USD" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.userConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currency: "USD" } }),
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
  it("updates active plan with ownership check", async () => {
    const config = {
      id: "c1",
      activePlanId: "p1",
      activePlan: { categories: [] },
    };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);
    mockPrisma.budgetPlan.findFirst.mockResolvedValue({
      id: "p2",
      userId: TEST_USER.id,
    });
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
      makeFormData({ planId: "p1", name: "", categories: "[]" }),
    );
    expect(result).toEqual({ success: false, error: "Plan name is required." });
  });

  it("verifies ownership before updating", async () => {
    mockPrisma.budgetPlan.findFirst.mockResolvedValue(null); // not found = not owned
    const cats = JSON.stringify([{ id: "c1", name: "A", percentage: 100 }]);
    const result = await updateBudgetPlan(
      makeFormData({ planId: "p1", name: "Plan", categories: cats }),
    );
    expect(result).toEqual({ success: false, error: "Plan not found." });
  });

  it("rejects percentages != 100", async () => {
    mockPrisma.budgetPlan.findFirst.mockResolvedValue({
      id: "p1",
      userId: TEST_USER.id,
    });
    const cats = JSON.stringify([{ id: "c1", name: "A", percentage: 50 }]);
    const result = await updateBudgetPlan(
      makeFormData({ planId: "p1", name: "Plan", categories: cats }),
    );
    expect(result).toEqual({
      success: false,
      error: "Percentages must sum to 100.",
    });
  });

  it("updates plan and categories with userId filtering", async () => {
    mockPrisma.budgetPlan.findFirst.mockResolvedValue({
      id: "p1",
      userId: TEST_USER.id,
    });
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
      makeFormData({ planId: "p1", name: "Updated", categories: cats }),
    );
    expect(result).toEqual({ success: true });
    // cat2 changed from isSavings=false to true, so transactions should be retyped
    expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoryId: "cat2", userId: TEST_USER.id },
        data: { type: "SAVINGS" },
      }),
    );
  });

  it("handles removed categories", async () => {
    mockPrisma.budgetPlan.findFirst.mockResolvedValue({
      id: "p1",
      userId: TEST_USER.id,
    });
    const cats = JSON.stringify([
      { id: "cat1", name: "Only", percentage: 100, isSavings: false },
    ]);
    mockPrisma.budgetCategory.findMany.mockResolvedValue([
      { id: "cat1", isSavings: false },
      { id: "cat2", isSavings: false },
    ]);
    mockPrisma.transaction.updateMany.mockResolvedValue({});
    mockPrisma.budgetCategory.deleteMany.mockResolvedValue({});
    mockPrisma.budgetCategory.update.mockResolvedValue({});
    mockPrisma.budgetPlan.update.mockResolvedValue({});

    const result = await updateBudgetPlan(
      makeFormData({ planId: "p1", name: "Plan", categories: cats }),
    );
    expect(result).toEqual({ success: true });
    // cat2 removed: transactions nullified with userId filter, category deleted
    expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { categoryId: { in: ["cat2"] }, userId: TEST_USER.id },
      }),
    );
    expect(mockPrisma.budgetCategory.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["cat2"] } } }),
    );
  });
});

// ==================== createCustomPlan ====================

describe("createCustomPlan", () => {
  it("creates plan with userId", async () => {
    const cats = JSON.stringify([
      { name: "A", percentage: 60, isSavings: false },
      { name: "B", percentage: 40, isSavings: true },
    ]);
    mockPrisma.budgetPlan.create.mockResolvedValue({ id: "cp1" });

    const result = await createCustomPlan(
      makeFormData({ name: "Custom", categories: cats }),
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.budgetPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: TEST_USER.id }),
      }),
    );
  });

  it("rejects empty name", async () => {
    const result = await createCustomPlan(
      makeFormData({ name: "", categories: "[]" }),
    );
    expect(result).toEqual({ success: false, error: "Plan name is required." });
  });
});

// ==================== deleteBudgetPlan ====================

describe("deleteBudgetPlan", () => {
  it("deletes non-active custom plan with ownership check", async () => {
    const config = {
      id: "c1",
      activePlanId: "p1",
      activePlan: { categories: [] },
    };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);
    mockPrisma.budgetPlan.findFirst.mockResolvedValue({
      id: "p2",
      isDefault: false,
      isCustom: true,
      userId: TEST_USER.id,
    });
    mockPrisma.budgetCategory.findMany.mockResolvedValue([{ id: "cat1" }]);
    mockPrisma.transaction.updateMany.mockResolvedValue({});
    mockPrisma.budgetPlan.deleteMany.mockResolvedValue({});

    const result = await deleteBudgetPlan(makeFormData({ planId: "p2" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.budgetPlan.deleteMany).toHaveBeenCalledWith({
      where: { id: "p2", userId: TEST_USER.id },
    });
  });

  it("rejects deleting active plan", async () => {
    const config = {
      id: "c1",
      activePlanId: "p1",
      activePlan: { categories: [] },
    };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);

    const result = await deleteBudgetPlan(makeFormData({ planId: "p1" }));
    expect(result).toEqual({
      success: false,
      error: "Cannot delete the active plan.",
    });
  });

  it("rejects deleting default plan", async () => {
    const config = {
      id: "c1",
      activePlanId: "p1",
      activePlan: { categories: [] },
    };
    mockPrisma.userConfig.findFirst.mockResolvedValue(config);
    mockPrisma.budgetPlan.findFirst.mockResolvedValue({
      id: "p2",
      isDefault: true,
      userId: TEST_USER.id,
    });

    const result = await deleteBudgetPlan(makeFormData({ planId: "p2" }));
    expect(result).toEqual({
      success: false,
      error: "Cannot delete a default plan.",
    });
  });

  it("rejects missing planId", async () => {
    const result = await deleteBudgetPlan(makeFormData({ planId: "" }));
    expect(result).toEqual({ success: false, error: "Plan ID is required." });
  });
});

// ==================== getSavingsGoals ====================

describe("getSavingsGoals", () => {
  it("returns goals filtered by userId with computed currentAmount", async () => {
    mockPrisma.savingsGoal.findMany.mockResolvedValue([
      {
        id: "g1",
        name: "Emergency",
        targetAmount: 100000,
        categoryId: "cat1",
        category: { name: "Savings" },
      },
    ]);
    mockPrisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: 25000 },
    });

    const result = await getSavingsGoals();
    expect(result).toHaveLength(1);
    expect(result[0].currentAmount).toBe(25000);
    expect(mockPrisma.savingsGoal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
      }),
    );
  });

  it("returns 0 currentAmount when no category linked", async () => {
    mockPrisma.savingsGoal.findMany.mockResolvedValue([
      {
        id: "g2",
        name: "Trip",
        targetAmount: 50000,
        categoryId: null,
        category: null,
      },
    ]);

    const result = await getSavingsGoals();
    expect(result[0].currentAmount).toBe(0);
  });
});

// ==================== createSavingsGoal ====================

describe("createSavingsGoal", () => {
  it("rejects categoryId not owned by user", async () => {
    mockPrisma.budgetCategory.findFirst.mockResolvedValue(null);

    const result = await createSavingsGoal(
      makeFormData({
        name: "Test Goal",
        targetAmount: "10000",
        categoryId: "other-user-cat",
        deadline: "",
      }),
    );
    expect(result).toEqual({ success: false, error: "Category not found." });
    expect(mockPrisma.savingsGoal.create).not.toHaveBeenCalled();
  });

  it("creates goal with userId", async () => {
    mockPrisma.budgetCategory.findFirst.mockResolvedValue({ id: "cat1" });
    mockPrisma.savingsGoal.create.mockResolvedValue({ id: "g1" });

    const result = await createSavingsGoal(
      makeFormData({
        name: "Emergency Fund",
        targetAmount: "100000",
        categoryId: "cat1",
        deadline: "2026-12-31",
      }),
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.savingsGoal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: TEST_USER.id }),
      }),
    );
  });

  it("rejects empty name", async () => {
    const result = await createSavingsGoal(
      makeFormData({
        name: "",
        targetAmount: "100",
        categoryId: "",
        deadline: "",
      }),
    );
    expect(result).toEqual({ success: false, error: "Name is required." });
  });

  it("rejects non-positive target", async () => {
    const result = await createSavingsGoal(
      makeFormData({
        name: "Test",
        targetAmount: "0",
        categoryId: "",
        deadline: "",
      }),
    );
    expect(result).toEqual({
      success: false,
      error: "Target must be a positive number.",
    });
  });
});

// ==================== deleteSavingsGoal ====================

describe("deleteSavingsGoal", () => {
  it("deletes goal with userId ownership check", async () => {
    mockPrisma.savingsGoal.delete.mockResolvedValue({});
    const result = await deleteSavingsGoal(makeFormData({ id: "g1" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.savingsGoal.delete).toHaveBeenCalledWith({
      where: { id: "g1", userId: TEST_USER.id },
    });
  });

  it("rejects missing ID", async () => {
    const result = await deleteSavingsGoal(makeFormData({ id: "" }));
    expect(result).toEqual({ success: false, error: "Goal ID is required." });
  });
});

// ==================== getRecurringTransactions ====================

describe("getRecurringTransactions", () => {
  it("returns rules filtered by userId", async () => {
    const rules = [{ id: "r1", amount: 1000, dayOfMonth: 1, category: null }];
    mockPrisma.recurringTransaction.findMany.mockResolvedValue(rules);

    const result = await getRecurringTransactions();
    expect(result).toEqual(rules);
    expect(mockPrisma.recurringTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
      }),
    );
  });
});

// ==================== createRecurringTransaction ====================

describe("createRecurringTransaction", () => {
  it("creates rule with userId", async () => {
    mockPrisma.recurringTransaction.create.mockResolvedValue({ id: "r1" });

    const result = await createRecurringTransaction(
      makeFormData({
        amount: "5000",
        type: "INCOME",
        categoryId: "",
        note: "Salary",
        dayOfMonth: "25",
      }),
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.recurringTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: TEST_USER.id }),
      }),
    );
  });

  it("rejects non-positive amount", async () => {
    const result = await createRecurringTransaction(
      makeFormData({
        amount: "0",
        type: "INCOME",
        categoryId: "",
        dayOfMonth: "1",
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects dayOfMonth > 28", async () => {
    const result = await createRecurringTransaction(
      makeFormData({
        amount: "100",
        type: "INCOME",
        categoryId: "",
        dayOfMonth: "31",
      }),
    );
    expect(result).toEqual({ success: false, error: "Day must be 1-28." });
  });

  it("rejects dayOfMonth < 1", async () => {
    const result = await createRecurringTransaction(
      makeFormData({
        amount: "100",
        type: "INCOME",
        categoryId: "",
        dayOfMonth: "0",
      }),
    );
    expect(result).toEqual({ success: false, error: "Day must be 1-28." });
  });

  it("rejects EXPENSE without category", async () => {
    const result = await createRecurringTransaction(
      makeFormData({
        amount: "100",
        type: "EXPENSE",
        categoryId: "",
        dayOfMonth: "15",
      }),
    );
    expect(result).toEqual({ success: false, error: "Category is required." });
  });
});

// ==================== deleteRecurringTransaction ====================

describe("deleteRecurringTransaction", () => {
  it("deletes rule with userId ownership check", async () => {
    mockPrisma.recurringTransaction.delete.mockResolvedValue({});
    const result = await deleteRecurringTransaction(makeFormData({ id: "r1" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.recurringTransaction.delete).toHaveBeenCalledWith({
      where: { id: "r1", userId: TEST_USER.id },
    });
  });

  it("rejects missing ID", async () => {
    const result = await deleteRecurringTransaction(makeFormData({ id: "" }));
    expect(result).toEqual({ success: false, error: "ID is required." });
  });
});

// ==================== toggleRecurringTransaction ====================

describe("toggleRecurringTransaction", () => {
  it("toggles from active to inactive", async () => {
    mockPrisma.recurringTransaction.findFirst.mockResolvedValue({
      id: "r1",
      isActive: true,
    });
    mockPrisma.recurringTransaction.update.mockResolvedValue({});

    const result = await toggleRecurringTransaction(makeFormData({ id: "r1" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.recurringTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it("toggles from inactive to active", async () => {
    mockPrisma.recurringTransaction.findFirst.mockResolvedValue({
      id: "r1",
      isActive: false,
    });
    mockPrisma.recurringTransaction.update.mockResolvedValue({});

    const result = await toggleRecurringTransaction(makeFormData({ id: "r1" }));
    expect(result).toEqual({ success: true });
    expect(mockPrisma.recurringTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true } }),
    );
  });

  it("rejects missing ID", async () => {
    const result = await toggleRecurringTransaction(makeFormData({ id: "" }));
    expect(result).toEqual({ success: false, error: "ID is required." });
  });
});

// ==================== processRecurringTransactions ====================

describe("processRecurringTransactions", () => {
  it("creates transaction with userId when day has passed", async () => {
    const now = new Date();
    mockPrisma.recurringTransaction.findMany.mockResolvedValue([
      {
        id: "r1",
        amount: 5000,
        type: "INCOME",
        note: "Salary",
        dayOfMonth: 1,
        categoryId: null,
      },
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
            userId: TEST_USER.id,
          }),
        }),
      );
    }
  });

  it("skips when transaction already exists for this month", async () => {
    mockPrisma.recurringTransaction.findMany.mockResolvedValue([
      {
        id: "r1",
        amount: 5000,
        type: "INCOME",
        note: null,
        dayOfMonth: 1,
        categoryId: null,
      },
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
  it("groups transactions by year and 1-indexed month", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: "t1",
        amount: 5000,
        type: "INCOME",
        note: null,
        date: new Date("2025-01-15"),
        category: null,
        categoryId: null,
      },
      {
        id: "t2",
        amount: 2000,
        type: "EXPENSE",
        note: "Rent",
        date: new Date("2025-01-20"),
        category: { name: "Needs" },
        categoryId: "c1",
      },
      {
        id: "t3",
        amount: 1000,
        type: "SAVINGS",
        note: null,
        date: new Date("2025-02-01"),
        category: { name: "Savings" },
        categoryId: "c2",
      },
    ]);

    const result = await getMonthlySummary();
    expect(result).toHaveLength(1); // 1 year
    expect(result[0].year).toBe(2025);
    expect(result[0].months).toHaveLength(2); // Jan and Feb

    // Months are now 1-indexed
    const jan = result[0].months.find((m) => m.month === 1);
    expect(jan!.income).toBe(5000);
    expect(jan!.expenses).toBe(2000);

    const feb = result[0].months.find((m) => m.month === 2);
    expect(feb!.savings).toBe(1000);

    // Verify userId filtering
    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
      }),
    );
  });

  it("rounds accumulated sums to avoid float drift", async () => {
    // 200 transactions of 0.01 each
    const txs = Array.from({ length: 200 }, (_, i) => ({
      id: `t${i}`,
      amount: 0.01,
      type: "EXPENSE" as const,
      note: null,
      date: new Date("2025-01-15"),
      category: { name: "Needs" },
      categoryId: "c1",
    }));
    mockPrisma.transaction.findMany.mockResolvedValue(txs);

    const result = await getMonthlySummary();
    const jan = result[0].months[0];
    // Without rounding: 2.0000000000000018
    // With rounding: 2.00
    expect(jan.expenses).toBe(2);
  });

  it("returns empty array when no transactions", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const result = await getMonthlySummary();
    expect(result).toEqual([]);
  });
});

// ==================== createRecurringTransaction categoryId ====================

describe("createRecurringTransaction categoryId ownership", () => {
  it("rejects categoryId not owned by user", async () => {
    mockPrisma.budgetCategory.findFirst.mockResolvedValue(null);

    const result = await createRecurringTransaction(
      makeFormData({
        amount: "100",
        type: "EXPENSE",
        categoryId: "other-user-cat",
        dayOfMonth: "15",
      }),
    );
    expect(result).toEqual({ success: false, error: "Category not found." });
    expect(mockPrisma.recurringTransaction.create).not.toHaveBeenCalled();
  });

  it("creates rule when categoryId is owned by user", async () => {
    mockPrisma.budgetCategory.findFirst.mockResolvedValue({ id: "cat1" });
    mockPrisma.recurringTransaction.create.mockResolvedValue({ id: "r1" });

    const result = await createRecurringTransaction(
      makeFormData({
        amount: "100",
        type: "EXPENSE",
        categoryId: "cat1",
        note: "Rent",
        dayOfMonth: "1",
      }),
    );
    expect(result).toEqual({ success: true });
  });
});

// ==================== registerUser ====================

describe("registerUser", () => {
  it("rejects empty name", async () => {
    const result = await registerUser(
      makeFormData({
        name: "",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "password123",
      }),
    );
    expect(result).toEqual({ success: false, error: "Name is required." });
  });

  it("rejects empty email", async () => {
    const result = await registerUser(
      makeFormData({
        name: "Test",
        email: "",
        password: "password123",
        confirmPassword: "password123",
      }),
    );
    expect(result).toEqual({ success: false, error: "Email is required." });
  });

  it("rejects invalid email format", async () => {
    const result = await registerUser(
      makeFormData({
        name: "Test",
        email: "not-an-email",
        password: "password123",
        confirmPassword: "password123",
      }),
    );
    expect(result).toEqual({ success: false, error: "Invalid email format." });
  });

  it("rejects short password", async () => {
    const result = await registerUser(
      makeFormData({
        name: "Test",
        email: "test@example.com",
        password: "short",
        confirmPassword: "short",
      }),
    );
    expect(result).toEqual({
      success: false,
      error: "Password must be at least 8 characters.",
    });
  });

  it("rejects mismatched passwords", async () => {
    const result = await registerUser(
      makeFormData({
        name: "Test",
        email: "test@example.com",
        password: "password123",
        confirmPassword: "different123",
      }),
    );
    expect(result).toEqual({
      success: false,
      error: "Passwords do not match.",
    });
  });

  it("rejects duplicate email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: "existing" });

    const result = await registerUser(
      makeFormData({
        name: "Test",
        email: "existing@example.com",
        password: "password123",
        confirmPassword: "password123",
      }),
    );
    expect(result).toEqual({
      success: false,
      error: "An account with this email already exists.",
    });
  });

  it("creates user on valid input", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({ id: "new-user" });

    const result = await registerUser(
      makeFormData({
        name: "New User",
        email: "new@example.com",
        password: "password123",
        confirmPassword: "password123",
      }),
    );
    expect(result).toEqual({ success: true });
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "New User",
          email: "new@example.com",
        }),
      }),
    );
  });

  it("handles race condition on duplicate create gracefully", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockRejectedValue(
      new Error("Unique constraint failed"),
    );

    const result = await registerUser(
      makeFormData({
        name: "Test",
        email: "race@example.com",
        password: "password123",
        confirmPassword: "password123",
      }),
    );
    expect(result).toEqual({
      success: false,
      error: "An account with this email already exists.",
    });
  });
});

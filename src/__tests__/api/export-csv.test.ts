import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/export-csv/route";

const TEST_USER = vi.hoisted(() => ({
  id: "test-user-id",
  name: "Test User",
  email: "test@test.com",
}));

const mockPrisma = vi.hoisted(() => ({
  transaction: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth-utils", () => ({
  getSession: vi.fn().mockResolvedValue({ user: TEST_USER }),
}));

describe("GET /api/export-csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns CSV with correct headers", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const response = await GET();

    expect(response.headers.get("Content-Type")).toBe("text/csv");
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="centa-transactions-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
  });

  it("formats transaction rows correctly", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        date: new Date("2025-03-15T00:00:00Z"),
        type: "EXPENSE",
        category: { name: "Food" },
        amount: 450,
        note: "Lunch",
      },
      {
        date: new Date("2025-03-14T00:00:00Z"),
        type: "INCOME",
        category: null,
        amount: 30000,
        note: null,
      },
    ]);

    const response = await GET();
    const text = await response.text();
    const lines = text.split("\n");

    expect(lines[0]).toBe("Date,Type,Category,Amount,Note");
    expect(lines[1]).toBe('2025-03-15,EXPENSE,Food,450,"Lunch"');
    expect(lines[2]).toBe("2025-03-14,INCOME,,30000,");
    expect(lines).toHaveLength(3);
  });

  it("escapes double quotes in notes", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        date: new Date("2025-01-01T00:00:00Z"),
        type: "EXPENSE",
        category: { name: "Shopping" },
        amount: 200,
        note: 'Got a "deal" on shoes',
      },
    ]);

    const response = await GET();
    const text = await response.text();
    const lines = text.split("\n");

    expect(lines[1]).toBe(
      '2025-01-01,EXPENSE,Shopping,200,"Got a ""deal"" on shoes"',
    );
  });

  it("uses local date format (not UTC)", async () => {
    // Create a date that would differ between UTC and local timezone
    const localDate = new Date(2025, 2, 15, 0, 0, 0); // March 15, midnight local
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        date: localDate,
        type: "INCOME",
        category: null,
        amount: 1000,
        note: null,
      },
    ]);

    const response = await GET();
    const text = await response.text();
    const lines = text.split("\n");

    // date-fns format uses local time, so should always be 2025-03-15
    expect(lines[1]).toMatch(/^2025-03-15,/);
  });

  it("returns only header row when no transactions exist", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const response = await GET();
    const text = await response.text();

    expect(text).toBe("Date,Type,Category,Amount,Note");
  });

  it("filters transactions by userId", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TEST_USER.id },
      }),
    );
  });

  it("returns 401 when not authenticated", async () => {
    const { getSession } = await import("@/lib/auth-utils");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(getSession).mockResolvedValueOnce(null as any);

    const response = await GET();
    expect(response.status).toBe(401);
  });
});

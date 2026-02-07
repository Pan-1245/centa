import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  transaction: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/export-csv/route";

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

  it("returns only header row when no transactions exist", async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);

    const response = await GET();
    const text = await response.text();

    expect(text).toBe("Date,Type,Category,Amount,Note");
  });
});

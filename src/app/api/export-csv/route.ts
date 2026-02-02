import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const transactions = await prisma.transaction.findMany({
    include: { category: true },
    orderBy: { date: "desc" },
  });

  const header = "Date,Type,Category,Amount,Note";
  const rows = transactions.map((tx) => {
    const date = new Date(tx.date).toISOString().split("T")[0];
    const category = tx.category?.name ?? "";
    const note = tx.note ? `"${tx.note.replace(/"/g, '""')}"` : "";
    return `${date},${tx.type},${category},${tx.amount},${note}`;
  });

  const csv = [header, ...rows].join("\n");
  const today = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="centa-transactions-${today}.csv"`,
    },
  });
}

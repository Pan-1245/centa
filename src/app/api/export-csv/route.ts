import { format } from "date-fns";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const transactions = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    include: { category: true },
    orderBy: { date: "desc" },
  });

  const header = "Date,Type,Category,Amount,Note";
  const rows = transactions.map((tx) => {
    const date = format(new Date(tx.date), "yyyy-MM-dd");
    const category = tx.category?.name ?? "";
    const note = tx.note ? `"${tx.note.replace(/"/g, '""')}"` : "";
    return `${date},${tx.type},${category},${tx.amount},${note}`;
  });

  const csv = [header, ...rows].join("\n");
  const today = format(new Date(), "yyyy-MM-dd");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="centa-transactions-${today}.csv"`,
    },
  });
}

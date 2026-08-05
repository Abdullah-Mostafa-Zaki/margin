"use server";

import { verifyOrgAccess } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { startOfCairoMonth, endOfCairoMonth } from "@/lib/date-utils";

async function fetchMonthMetrics(organizationId: string) {
  const now = new Date();
  
  const startOfMonthUtc = startOfCairoMonth(now);
  const endOfMonthUtc = endOfCairoMonth(now);

  const grouped = await prisma.transaction.groupBy({
    by: ["type", "status"],
    where: {
      organizationId,
      OR: [
        { dateConfidence: "CONFIRMED" as const, date: { gte: startOfMonthUtc, lte: endOfMonthUtc } },
        { 
          dateConfidence: "ESTIMATED" as const,
          estimatedRangeStart: { gte: startOfMonthUtc },
          estimatedRangeEnd: { lte: endOfMonthUtc },
        }
      ],
    },
    _sum: { amount: true },
  });

  let monthRevenue = 0;
  let monthExpenses = 0;

  grouped.forEach((g) => {
    const amt = Number(g._sum.amount || 0);
    if (g.type === "INCOME" && g.status === "RECEIVED") {
      monthRevenue += amt;
    } else if (g.type === "EXPENSE") {
      monthExpenses += amt;
    }
  });

  const monthNetProfit = monthRevenue - monthExpenses;

  return {
    monthRevenue,
    monthExpenses,
    monthNetProfit,
  };
}

export async function getMonthMetrics(organizationId: string) {
  await verifyOrgAccess(organizationId);

  const getCached = unstable_cache(
    async () => fetchMonthMetrics(organizationId),
    ["monthMetrics", organizationId],
    {
      tags: [`org-${organizationId}-transactions`],
      revalidate: 300, // 5 minutes
    }
  );
  return getCached();
}

"use server";

import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";

async function fetchTodayMetrics(organizationId: string) {
  // Start of today in local time (or UTC depending on server setup)
  // We'll use UTC start of day for consistency, or just construct it from current Date
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const grouped = await prisma.transaction.groupBy({
    by: ["type", "status"],
    where: {
      organizationId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    _sum: { amount: true },
  });

  let todayRevenue = 0;
  let todayExpenses = 0;

  grouped.forEach((g) => {
    const amt = Number(g._sum.amount || 0);
    if (g.type === "INCOME" && g.status === "RECEIVED") {
      todayRevenue += amt;
    } else if (g.type === "EXPENSE") {
      todayExpenses += amt;
    }
  });

  const todayNetProfit = todayRevenue - todayExpenses;

  return {
    todayRevenue,
    todayExpenses,
    todayNetProfit,
  };
}

export async function getTodayMetrics(organizationId: string) {
  const getCached = unstable_cache(
    async () => fetchTodayMetrics(organizationId),
    ["todayMetrics", organizationId],
    {
      tags: [`org-${organizationId}-transactions`],
      revalidate: 300, // 5 minutes
    }
  );
  return getCached();
}

"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface DropPerformance {
  dropId: string;
  dropName: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  revenue: number;
  adSpend: number;
  productionCost: number;
  netMargin: number;
  netMarginPercent: number;
}

import { unstable_cache } from 'next/cache';

export async function fetchDropPerformance(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<DropPerformance[]> {
  const dateFilter: any = startDate && endDate ? {
    date: {
      gte: startDate,
      lte: endDate,
    },
    OR: [
      { dateConfidence: "CONFIRMED" },
      { 
        dateConfidence: "ESTIMATED",
        estimatedRangeStart: { gte: startDate },
        estimatedRangeEnd: { lte: endDate },
      }
    ]
  } : {};

  // Fetch all drops for the org, filtered by tagId if provided
  const drops = await prisma.drop.findMany({
    where: { organizationId, ...(tagId ? { id: tagId } : {}) }
  });

  if (drops.length === 0) return [];

  const dropIds = drops.map((d) => d.id);

  // ── 2 total DB queries (down from 2×N) ────────────────────────────────────

  // Query 1: Income amounts per drop, fetched via the TransactionDrop join table.
  const allIncomeRows = await prisma.transactionDrop.findMany({
    where: {
      dropId: { in: dropIds },
      transaction: {
        organizationId,
        type: 'INCOME',
        ...dateFilter,
      },
    },
    select: {
      dropId: true,
      transaction: {
        select: { amount: true, status: true },
      },
    },
  });

  // Query 2: Expense amounts per drop, fetched via the TransactionDrop join table.
  // Expenses use the many-to-many relation (a single expense can be shared across drops).
  const allExpenseRows = await prisma.transactionDrop.findMany({
    where: {
      dropId: { in: dropIds },
      transaction: {
        organizationId,
        type: 'EXPENSE',
        ...dateFilter,
      },
    },
    select: {
      dropId: true,
      transaction: {
        select: { amount: true, category: true },
      },
    },
  });

  // ── Build lookup maps in JS ────────────────────────────────────────────────

  // Income map: dropId → { revenue }
  const incomeMap = new Map<string, { revenue: number }>();
  for (const row of allIncomeRows) {
    const existing = incomeMap.get(row.dropId) ?? { revenue: 0 };
    if (row.transaction.status === 'RECEIVED') {
      existing.revenue += Number(row.transaction.amount || 0);
    }
    incomeMap.set(row.dropId, existing);
  }

  // Expense map: dropId → { adSpend, productionCost, shippingCost }
  const expenseMap = new Map<string, { adSpend: number; productionCost: number; shippingCost: number }>();
  for (const row of allExpenseRows) {
    const existing = expenseMap.get(row.dropId) ?? { adSpend: 0, productionCost: 0, shippingCost: 0 };
    const amt = Number(row.transaction.amount || 0);
    const cat = row.transaction.category?.toLowerCase() ?? '';
    if (cat === 'ads' || cat === 'marketing' || cat === 'ad spend') {
      existing.adSpend += amt;
    } else if (cat === 'raw materials' || cat === 'packaging') {
      existing.productionCost += amt;
    } else if (cat === 'logistics (shipping)') {
      existing.shippingCost += amt;
    }
    expenseMap.set(row.dropId, existing);
  }

  // ── Build per-drop result (same output shape as before) ───────────────────

  const performances: DropPerformance[] = drops.map((drop) => {
    const inc = incomeMap.get(drop.id) ?? { revenue: 0 };
    const exp = expenseMap.get(drop.id) ?? { adSpend: 0, productionCost: 0, shippingCost: 0 };

    const { revenue } = inc;
    const { adSpend, productionCost, shippingCost } = exp;

    const netMargin = revenue - adSpend - productionCost - shippingCost;
    const netMarginPercent = revenue > 0 ? (netMargin / revenue) * 100 : 0;

    return {
      dropId: drop.id,
      dropName: drop.name,
      status: drop.status,
      startDate: drop.startDate,
      endDate: drop.endDate,
      revenue,
      adSpend,
      productionCost,
      netMargin,
      netMarginPercent: Number(netMarginPercent.toFixed(1)),
    };
  });

  // Sort by revenue descending (same as before)
  performances.sort((a, b) => b.revenue - a.revenue);

  return performances;
}

export async function getDropPerformance(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<DropPerformance[]> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized: No session");

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden: User does not belong to this organization");

  const getCached = unstable_cache(
    async () => fetchDropPerformance(organizationId, startDate, endDate, tagId),
    [
      'drop-performance',
      organizationId,
      startDate?.toISOString() || 'all',
      endDate?.toISOString() || 'all',
      tagId || 'none'
    ],
    {
      tags: [`org-${organizationId}-transactions`],
      revalidate: 3600
    }
  );

  return getCached();
}

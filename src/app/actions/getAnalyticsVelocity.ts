"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface VelocityDeltas {
  netProfit: number | null;
  realizedRevenue: number | null;
  totalExpenses: number | null;
  pendingEscrow: number | null;
}

import { unstable_cache } from 'next/cache';

async function fetchAnalyticsVelocity(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<VelocityDeltas> {
  let currentStart: Date | null = startDate;
  let currentEnd: Date | null = endDate;
  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;

  if (currentStart && currentEnd) {
    const durationMs = currentEnd.getTime() - currentStart.getTime();
    prevEnd = new Date(currentStart.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - durationMs);
  } else {
    // "All Time" - compare current month vs previous month
    const now = new Date();
    currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  }

  const tagFilter = tagId ? { 
    drops: { some: { dropId: tagId } }
  } : {};

  // Fetch current period transactions
  const currentTransactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      OR: [
        { dateConfidence: "CONFIRMED" as const, date: { gte: currentStart, lte: currentEnd } },
        { 
          dateConfidence: "ESTIMATED" as const,
          estimatedRangeStart: { gte: currentStart },
          estimatedRangeEnd: { lte: currentEnd },
        }
      ],
      ...tagFilter,
    },
    select: { type: true, amount: true, status: true },
  });

  // Fetch previous period transactions
  const prevTransactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      OR: [
        { dateConfidence: "CONFIRMED" as const, date: { gte: prevStart, lte: prevEnd } },
        { 
          dateConfidence: "ESTIMATED" as const,
          estimatedRangeStart: { gte: prevStart },
          estimatedRangeEnd: { lte: prevEnd },
        }
      ],
      ...tagFilter,
    },
    select: { type: true, amount: true, status: true },
  });

  const calculateMetrics = (txs: any[]) => {
    let realizedRevenue = 0;
    let pendingEscrow = 0;
    let manualExpenses = 0;

    txs.forEach((t) => {
      if (t.type === "INCOME") {
        if (t.status === "RECEIVED") realizedRevenue += Number(t.amount);
        if (t.status === "PENDING") pendingEscrow += Number(t.amount);
      } else if (t.type === "EXPENSE") {
        manualExpenses += Number(t.amount);
      }
    });

    const totalExpenses = manualExpenses;
    const netProfit = realizedRevenue - totalExpenses;

    return { netProfit, realizedRevenue, totalExpenses, pendingEscrow };
  };

  const currentMetrics = calculateMetrics(currentTransactions);
  const prevMetrics = calculateMetrics(prevTransactions);

  const calculateDelta = (current: number, previous: number) => {
    if (previous === 0) return null; // Can't calculate percentage if previous was 0
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  // If there are no transactions in the previous period, we return null for deltas
  if (prevTransactions.length === 0) {
    return { netProfit: null, realizedRevenue: null, totalExpenses: null, pendingEscrow: null };
  }

  return {
    netProfit: calculateDelta(currentMetrics.netProfit, prevMetrics.netProfit),
    realizedRevenue: calculateDelta(currentMetrics.realizedRevenue, prevMetrics.realizedRevenue),
    totalExpenses: calculateDelta(currentMetrics.totalExpenses, prevMetrics.totalExpenses),
    pendingEscrow: calculateDelta(currentMetrics.pendingEscrow, prevMetrics.pendingEscrow),
  };
}

export async function getAnalyticsVelocity(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<VelocityDeltas> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized: No session");

  const org = await prisma.organization.findFirst({ where: { deletedAt: null,  id: organizationId },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden: User does not belong to this organization");

  const getCached = unstable_cache(
    async () => fetchAnalyticsVelocity(organizationId, startDate, endDate, tagId),
    [
      'analytics-velocity',
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

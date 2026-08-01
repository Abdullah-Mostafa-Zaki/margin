import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface MarketingMetrics {
  roas: number | null;
  roasPrevious: number | null;
  cac: number | null;
  cacPrevious: number | null;
  adSpendByDate: { date: Date; amount: number }[];
}

import { unstable_cache } from 'next/cache';

async function fetchMarketingMetrics(
  organizationId: string,
  startDate?: Date,
  endDate?: Date,
  tagId?: string
): Promise<MarketingMetrics> {
  const dateFilter: Prisma.TransactionWhereInput = startDate && endDate ? { 
    date: { gte: startDate, lte: endDate },
    OR: [
      { dateConfidence: "CONFIRMED" as any },
      { 
        dateConfidence: "ESTIMATED" as any,
        estimatedRangeStart: { gte: startDate },
        estimatedRangeEnd: { lte: endDate },
      }
    ]
  } : {};
  const isAllTime = !startDate && !endDate;

  // Helper to fetch metrics for a given period
  const fetchPeriodMetrics = async (filter: Prisma.TransactionWhereInput, pStart?: Date) => {
    const localTagFilter = tagId ? { 
      OR: [
        { dropId: tagId },
        { drops: { some: { dropId: tagId } } }
      ]
    } : {};

    // A. Ad Spend
    const adSpendTxs = await prisma.transaction.findMany({
      where: {
        organizationId,
        type: "EXPENSE",
        status: "RECEIVED",
        ...filter,
        ...localTagFilter,
        OR: [
          { category: { equals: "Ads", mode: "insensitive" } },
          { category: { equals: "Marketing", mode: "insensitive" } },
          { category: { equals: "Ad Spend", mode: "insensitive" } },
        ],
      },
      select: { amount: true, date: true },
      orderBy: { date: "asc" },
    });

    const totalAdSpend = adSpendTxs.reduce((sum, tx) => sum + Number(tx.amount), 0);

    // B. Realized Revenue
    const incomeTxs = await prisma.transaction.aggregate({
      where: {
        organizationId,
        type: "INCOME",
        status: "RECEIVED",
        ...filter,
        ...localTagFilter,
      },
      _sum: { amount: true },
    });
    const realizedRevenue = Number(incomeTxs._sum.amount || 0);

    const roas = totalAdSpend > 0 ? realizedRevenue / totalAdSpend : null;

    // C. New Customers
    let newCustomerCount = 0;
    
    const currentPeriodCustomers = await prisma.transaction.findMany({
      where: {
        organizationId,
        type: "INCOME",
        customerId: { not: null },
        ...filter,
        ...localTagFilter,
      },
      select: { customerId: true },
      distinct: ["customerId"],
    });

    const customerIds = currentPeriodCustomers.map((c) => c.customerId as string);

    if (customerIds.length > 0) {
      if (!pStart) {
        newCustomerCount = customerIds.length;
      } else {
        const existingPrior = await prisma.transaction.findMany({
          where: {
            organizationId,
            type: "INCOME",
            customerId: { in: customerIds },
            date: { lt: pStart },
            ...localTagFilter,
          },
          select: { customerId: true },
          distinct: ["customerId"],
        });

        const priorSet = new Set(existingPrior.map((c) => c.customerId as string));
        newCustomerCount = customerIds.filter((id) => !priorSet.has(id)).length;
      }
    }

    const cac = newCustomerCount > 0 ? totalAdSpend / newCustomerCount : (totalAdSpend > 0 ? totalAdSpend : null);

    return { totalAdSpend, roas, cac, adSpendTxs };
  };

  // Current Period
  const current = await fetchPeriodMetrics(dateFilter, startDate);

  // Previous Period
  let prevFilter: Prisma.TransactionWhereInput = {};
  if (isAllTime) {
    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    
    const currentMonthData = await fetchPeriodMetrics({ 
      date: { gte: startOfThisMonth },
      OR: [
        { dateConfidence: "CONFIRMED" as any },
        { 
          dateConfidence: "ESTIMATED" as any,
          estimatedRangeStart: { gte: startOfThisMonth }
        }
      ]
    }, startOfThisMonth);
    current.roas = currentMonthData.roas;
    current.cac = currentMonthData.cac;

    prevFilter = { 
      date: { gte: startOfLastMonth, lte: endOfLastMonth },
      OR: [
        { dateConfidence: "CONFIRMED" as any },
        { 
          dateConfidence: "ESTIMATED" as any,
          estimatedRangeStart: { gte: startOfLastMonth },
          estimatedRangeEnd: { lte: endOfLastMonth },
        }
      ]
    };
  } else {
    const duration = endDate!.getTime() - startDate!.getTime();
    const prevStart = new Date(startDate!.getTime() - duration - 1);
    const prevEnd = new Date(startDate!.getTime() - 1);
    prevFilter = { 
      date: { gte: prevStart, lte: prevEnd },
      OR: [
        { dateConfidence: "CONFIRMED" as any },
        { 
          dateConfidence: "ESTIMATED" as any,
          estimatedRangeStart: { gte: prevStart },
          estimatedRangeEnd: { lte: prevEnd },
        }
      ]
    };
  }

  const prev = await fetchPeriodMetrics(prevFilter, isAllTime ? undefined : new Date(startDate!.getTime() - (endDate!.getTime() - startDate!.getTime()) - 1));

  return {
    roas: current.roas,
    roasPrevious: prev.roas,
    cac: current.cac,
    cacPrevious: prev.cac,
    adSpendByDate: current.adSpendTxs.map((tx) => ({
      date: tx.date,
      amount: Number(tx.amount),
    })),
  };
}

export async function getMarketingMetrics(
  organizationId: string,
  startDate?: Date,
  endDate?: Date,
  tagId?: string
): Promise<MarketingMetrics> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  const getCached = unstable_cache(
    async () => fetchMarketingMetrics(organizationId, startDate, endDate, tagId),
    [
      'marketing-metrics',
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

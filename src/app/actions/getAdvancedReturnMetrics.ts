"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { unstable_cache } from "next/cache";

export interface ReturnedProduct {
  sku: string | null;
  name: string;
  quantity: number;
  lostRevenue: number;
}

export interface ReturnedDrop {
  dropId: string;
  dropName: string;
  totalOrders: number;
  returnedOrders: number;
  returnRate: number;
  lostRevenue: number;
}

export interface ReturnTrend {
  date: string;
  returnCount: number;
  lostRevenue: number;
}

export interface AdvancedReturnMetrics {
  products: ReturnedProduct[];
  drops: ReturnedDrop[];
  trends: ReturnTrend[];
}

export async function fetchAdvancedReturnMetrics(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<AdvancedReturnMetrics> {
  const dateFilter = startDate && endDate ? { 
    OR: [
      { dateConfidence: "CONFIRMED" as const, date: { gte: startDate, lte: endDate } },
      { 
        dateConfidence: "ESTIMATED" as const,
        estimatedRangeStart: { gte: startDate },
        estimatedRangeEnd: { lte: endDate },
      }
    ]
  } : {};
  const tagFilter = tagId ? { 
    drops: { some: { dropId: tagId } }
  } : {};

  // 1. Most Returned Products
  const returnedLineItems = await prisma.lineItem.findMany({
    where: {
      transaction: {
        organizationId,
        type: "INCOME",
        ...tagFilter,
        AND: [
          dateFilter,
          {
            OR: [
              { status: "RETURNED" },
              { fulfillmentStatus: "RETURNED" }
            ]
          }
        ]
      }
    },
    select: { name: true, sku: true, quantity: true, price: true }
  });

  const productMap = new Map<string, ReturnedProduct>();
  for (const item of returnedLineItems) {
    const key = item.sku || item.name;
    const rev = item.quantity * Number(item.price);
    const existing = productMap.get(key) || { sku: item.sku, name: item.name, quantity: 0, lostRevenue: 0 };
    existing.quantity += item.quantity;
    existing.lostRevenue += rev;
    productMap.set(key, existing);
  }
  const products = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // 2. Most Returned Drops
  // We fetch all INCOME transactions to calculate total orders vs returned orders per Drop
  const allDropTransactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      type: "INCOME",
      dropId: { not: null },
      ...dateFilter,
      ...tagFilter,
    },
    select: {
      dropId: true,
      status: true,
      fulfillmentStatus: true,
      amount: true,
      drop: { select: { name: true } }
    }
  });

  const dropMap = new Map<string, ReturnedDrop>();
  for (const tx of allDropTransactions) {
    if (!tx.dropId || !tx.drop) continue;

    const existing = dropMap.get(tx.dropId) || {
      dropId: tx.dropId,
      dropName: tx.drop.name,
      totalOrders: 0,
      returnedOrders: 0,
      returnRate: 0,
      lostRevenue: 0
    };

    existing.totalOrders += 1;
    if (tx.status === "RETURNED" || tx.fulfillmentStatus === "RETURNED") {
      existing.returnedOrders += 1;
      existing.lostRevenue += Number(tx.amount);
    }
    
    dropMap.set(tx.dropId, existing);
  }

  const drops = Array.from(dropMap.values()).map(d => ({
    ...d,
    returnRate: d.totalOrders > 0 ? (d.returnedOrders / d.totalOrders) * 100 : 0
  }))
  .sort((a, b) => b.lostRevenue - a.lostRevenue)
  .slice(0, 10);

  // 3. Return Trends (Time-Series)
  const returnedTransactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      type: "INCOME",
      ...tagFilter,
      AND: [
        dateFilter,
        {
          OR: [
            { status: "RETURNED" },
            { fulfillmentStatus: "RETURNED" }
          ]
        }
      ]
    },
    select: { date: true, amount: true }
  });

  const trendsMap = new Map<string, ReturnTrend>();
  for (const tx of returnedTransactions) {
    // Add 3 hours to convert UTC to Cairo time before taking the date string
    const dateObj = new Date(tx.date.getTime() + 3 * 60 * 60 * 1000);
    const dateStr = dateObj.toISOString().split('T')[0];
    
    const existing = trendsMap.get(dateStr) || { date: dateStr, returnCount: 0, lostRevenue: 0 };
    existing.returnCount += 1;
    existing.lostRevenue += Number(tx.amount);
    trendsMap.set(dateStr, existing);
  }

  const trends = Array.from(trendsMap.values())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return { products, drops, trends };
}

export async function getAdvancedReturnMetrics(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<AdvancedReturnMetrics> {
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
    async () => fetchAdvancedReturnMetrics(organizationId, startDate, endDate, tagId),
    [
      'advanced-return-metrics',
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

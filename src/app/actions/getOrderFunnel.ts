"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface OrderFunnelData {
  totalOrders: number;
  shipped: number;
  delivered: number;
  returned: number;
  returnRate: number;
}

import { unstable_cache } from 'next/cache';

async function fetchOrderFunnel(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<OrderFunnelData> {
    const dateFilter = startDate && endDate ? {
    date: {
      gte: startDate,
      lte: endDate,
    },
    OR: [
      { dateConfidence: "CONFIRMED" as const },
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

  // Base query: All INCOME transactions that represent actual customer orders
  const baseWhere = {
    organizationId,
    type: "INCOME" as const,
    category: { in: ["Sales Revenue", "Pop-up/Bazaar Sales", "Wholesale/B2B"] },
    ...dateFilter,
    ...tagFilter,
  };

  const totalOrders = await prisma.transaction.count({
    where: baseWhere,
  });

  const shipped = await prisma.transaction.count({
    where: {
      ...baseWhere,
      fulfillmentStatus: { in: ["SHIPPED", "DELIVERED", "RETURNED"] },
    },
  });

  const delivered = await prisma.transaction.count({
    where: {
      ...baseWhere,
      fulfillmentStatus: "DELIVERED",
    },
  });

  const returned = await prisma.transaction.count({
    where: {
      ...baseWhere,
      fulfillmentStatus: "RETURNED",
    },
  });

  const returnRate = totalOrders > 0 ? (returned / totalOrders) * 100 : 0;

  return {
    totalOrders,
    shipped,
    delivered,
    returned,
    returnRate,
  };
}

export async function getOrderFunnel(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<OrderFunnelData> {
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
    async () => fetchOrderFunnel(organizationId, startDate, endDate, tagId),
    [
      'order-funnel',
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

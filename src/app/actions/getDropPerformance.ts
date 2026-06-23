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

async function fetchDropPerformance(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<DropPerformance[]> {
  const dateFilter = startDate && endDate ? {
    date: {
      gte: startDate,
      lte: endDate,
    }
  } : {};

  // Fetch all drops for the org, filtered by tagId/dropId if provided
  const drops = await prisma.drop.findMany({
    where: { organizationId, ...(tagId ? { id: tagId } : {}) }
  });

  const performances: DropPerformance[] = await Promise.all(
    drops.map(async (drop) => {
      // INCOME transactions: use the exclusive dropId FK (prevents double-counting)
      const incomeGrouped = await prisma.transaction.groupBy({
        by: ['status'],
        where: {
          organizationId,
          dropId: drop.id,
          type: "INCOME",
          ...dateFilter
        },
        _sum: { amount: true, shipmentFee: true }
      });

      // EXPENSE transactions: use the many-to-many join (expenses can be shared)
      const expenseGrouped = await prisma.transaction.groupBy({
        by: ['category'],
        where: {
          organizationId,
          drops: { some: { dropId: drop.id } },
          type: "EXPENSE",
          ...dateFilter
        },
        _sum: { amount: true }
      });

      let revenue = 0;
      let shippingCost = 0;
      let adSpend = 0;
      let productionCost = 0;

      incomeGrouped.forEach((g) => {
        const amt = Number(g._sum.amount || 0);
        const ship = Number(g._sum.shipmentFee || 0);
        if (g.status === "RECEIVED") {
          revenue += amt;
        }
        if (ship > 0) {
          shippingCost += ship;
        }
      });

      expenseGrouped.forEach((g) => {
        const amt = Number(g._sum.amount || 0);
        const cat = g.category?.toLowerCase() || "";
        if (cat === "ads" || cat === "marketing" || cat === "ad spend") {
          adSpend += amt;
        } else if (cat === "raw materials" || cat === "packaging") {
          productionCost += amt;
        }
      });

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
        netMarginPercent: Number(netMarginPercent.toFixed(1))
      };
    })
  );

  // Sort by revenue descending
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

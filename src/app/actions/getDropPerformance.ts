"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface DropPerformance {
  dropName: string;
  revenue: number;
  adSpend: number;
  productionCost: number;
  netMargin: number;
  netMarginPercent: number;
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

  const dateFilter = startDate && endDate ? {
    date: {
      gte: startDate,
      lte: endDate,
    }
  } : {};

  // Fetch all tags (drops) for the org, filtered by tagId if provided
  const tags = await prisma.tag.findMany({
    where: { organizationId, ...(tagId ? { id: tagId } : {}) }
  });

  const performances: DropPerformance[] = await Promise.all(
    tags.map(async (tag) => {
      const grouped = await prisma.transaction.groupBy({
        by: ['type', 'status', 'category'],
        where: {
          organizationId,
          tags: { some: { tagId: tag.id } },
          ...dateFilter
        },
        _sum: { amount: true, shipmentFee: true }
      });

      let revenue = 0;
      let adSpend = 0;
      let productionCost = 0;
      let shippingCost = 0;

      grouped.forEach((g) => {
        const amt = Number(g._sum.amount || 0);
        const ship = Number(g._sum.shipmentFee || 0);

        if (g.type === "INCOME") {
          if (g.status === "RECEIVED") {
            revenue += amt;
          }
          if (ship > 0) {
            shippingCost += ship;
          }
        } else if (g.type === "EXPENSE") {
          const cat = g.category?.toLowerCase() || "";
          if (cat === "ads" || cat === "marketing" || cat === "ad spend") {
            adSpend += amt;
          } else if (cat === "raw materials" || cat === "packaging") {
            productionCost += amt;
          }
        }
      });

      const netMargin = revenue - adSpend - productionCost - shippingCost;
      const netMarginPercent = revenue > 0 ? (netMargin / revenue) * 100 : 0;

      return {
        dropName: tag.name,
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

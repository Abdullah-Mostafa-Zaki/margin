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
    where: { organizationId, ...(tagId ? { id: tagId } : {}) },
    include: {
      transactions: {
        where: {
          transaction: {
            ...dateFilter
          }
        },
        include: {
          transaction: true
        }
      }
    }
  });

  const performances: DropPerformance[] = [];

  for (const tag of tags) {
    let revenue = 0;
    let adSpend = 0;
    let productionCost = 0;
    let shippingCost = 0;

    for (const tt of tag.transactions) {
      const t = tt.transaction;
      if (t.type === "INCOME") {
        if (t.status === "RECEIVED") {
          revenue += Number(t.amount);
        }
        if (t.shipmentFee) {
          shippingCost += Number(t.shipmentFee);
        }
      } else if (t.type === "EXPENSE") {
        const cat = t.category?.toLowerCase() || "";
        if (cat === "ads" || cat === "marketing" || cat === "ad spend") {
          adSpend += Number(t.amount);
        } else if (cat === "raw materials" || cat === "packaging") {
          productionCost += Number(t.amount);
        }
      }
    }

    const netMargin = revenue - adSpend - productionCost - shippingCost;
    const netMarginPercent = revenue > 0 ? (netMargin / revenue) * 100 : 0;

    performances.push({
      dropName: tag.name,
      revenue,
      adSpend,
      productionCost,
      netMargin,
      netMarginPercent: Number(netMarginPercent.toFixed(1))
    });
  }

  // Sort by revenue descending
  performances.sort((a, b) => b.revenue - a.revenue);

  return performances;
}

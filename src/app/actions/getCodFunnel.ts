"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface CodFunnelData {
  totalOrders: number;
  shipped: number;
  delivered: number;
  returned: number;
  returnRate: number;
}

export async function getCodFunnel(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null
): Promise<CodFunnelData> {
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

  // Base query: COD INCOME transactions
  const baseWhere = {
    organizationId,
    paymentMethod: "COD" as const,
    type: "INCOME" as const,
    ...dateFilter,
  };

  const totalOrders = await prisma.transaction.count({
    where: baseWhere,
  });

  const shipped = await prisma.transaction.count({
    where: {
      ...baseWhere,
      OR: [
        { bostaTrackingNumber: { not: null } },
        { status: "RECEIVED" }
      ]
    },
  });

  const delivered = await prisma.transaction.count({
    where: {
      ...baseWhere,
      status: "RECEIVED",
    },
  });

  const returned = await prisma.transaction.count({
    where: {
      ...baseWhere,
      status: "RETURNED",
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

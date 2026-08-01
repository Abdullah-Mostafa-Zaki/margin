"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export interface CityReturnData {
  city: string;
  totalOrders: number;
  returned: number;
  returnRate: number;
}

import { unstable_cache } from 'next/cache';

async function fetchReturnsByCity(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<CityReturnData[]> {
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

  // Fetch COD INCOME transactions with a city
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      paymentMethod: "COD",
      type: "INCOME",
      customerCity: { not: null },
      ...dateFilter,
      ...tagFilter,
    },
    select: {
      customerCity: true,
      status: true,
    },
  });

  const cityMap = new Map<string, { totalOrders: number; returned: number }>();

  for (const t of transactions) {
    if (!t.customerCity) continue;
    
    // Normalize city: capitalize first letter, lowercase the rest
    const rawCity = t.customerCity.trim();
    if (!rawCity) continue;
    const normalizedCity = rawCity.charAt(0).toUpperCase() + rawCity.slice(1).toLowerCase();

    const existing = cityMap.get(normalizedCity) || { totalOrders: 0, returned: 0 };
    existing.totalOrders += 1;
    if (t.status === "RETURNED") {
      existing.returned += 1;
    }
    cityMap.set(normalizedCity, existing);
  }

  const results: CityReturnData[] = [];
  for (const [city, data] of Array.from(cityMap.entries())) {
    const returnRate = data.totalOrders > 0 ? (data.returned / data.totalOrders) * 100 : 0;
    results.push({
      city,
      totalOrders: data.totalOrders,
      returned: data.returned,
      returnRate,
    });
  }

  // Sort descending by returnRate, then by totalOrders
  results.sort((a, b) => {
    if (b.returnRate !== a.returnRate) {
      return b.returnRate - a.returnRate;
    }
    return b.totalOrders - a.totalOrders;
  });

  return results.slice(0, 10);
}

export async function getReturnsByCity(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<CityReturnData[]> {
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
    async () => fetchReturnsByCity(organizationId, startDate, endDate, tagId),
    [
      'returns-by-city',
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

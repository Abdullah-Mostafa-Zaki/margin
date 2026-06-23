"use server";

import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { DropStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DropSummary {
  id: string;
  name: string;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: DropStatus;
  // Computed fields
  computedStatus: "UPCOMING" | "LIVE" | "ENDED";
  daysRemaining: number | null;   // null if no endDate
  daysUntilStart: number | null;  // null if already started or no startDate
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDropStatus(startDate: Date | null, endDate: Date | null): "UPCOMING" | "LIVE" | "ENDED" {
  const now = new Date();
  if (!startDate && !endDate) return "UPCOMING";
  if (endDate && now > endDate) return "ENDED";
  if (startDate && now < startDate) return "UPCOMING";
  return "LIVE";
}

function getDaysRemaining(endDate: Date | null): number | null {
  if (!endDate) return null;
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getDaysUntilStart(startDate: Date | null): number | null {
  if (!startDate) return null;
  const now = new Date();
  const diff = startDate.getTime() - now.getTime();
  if (diff <= 0) return null; // Already started
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Fetch function ──────────────────────────────────────────────────────────

async function fetchDrops(organizationId: string): Promise<DropSummary[]> {
  const drops = await prisma.drop.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  return drops.map((drop) => {
    const computedStatus = computeDropStatus(drop.startDate, drop.endDate);
    return {
      ...drop,
      computedStatus,
      daysRemaining: computedStatus === "LIVE" ? getDaysRemaining(drop.endDate) : null,
      daysUntilStart: computedStatus === "UPCOMING" ? getDaysUntilStart(drop.startDate) : null,
    };
  }).sort((a, b) => {
    // Sort: LIVE first, then UPCOMING, then ENDED
    const order = { LIVE: 0, UPCOMING: 1, ENDED: 2 };
    return order[a.computedStatus] - order[b.computedStatus];
  });
}

// ─── Exported action ─────────────────────────────────────────────────────────

export async function getDrops(organizationId: string): Promise<DropSummary[]> {
  const getCached = unstable_cache(
    async () => fetchDrops(organizationId),
    ["drops", organizationId],
    {
      tags: [`org-${organizationId}-drops`],
      revalidate: 300, // 5 minutes — lifecycle changes on its own over time
    }
  );
  return getCached();
}

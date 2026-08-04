"use server";

import prisma from "@/lib/prisma";
import { unstable_cache } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  /** Stable identifier used for localStorage dismissal */
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  /** The key metric that triggered this alert (shown in the badge) */
  metric?: string;
}

// ─── Alert Thresholds ─────────────────────────────────────────────────────────
// Adjust these constants to tune alert sensitivity without touching logic.

const THRESHOLDS = {
  /** Return rate above this % triggers HIGH_RETURN_RATE */
  returnRatePct: 20,
  /** COD exposure above this % of realized revenue triggers EXCESSIVE_COD_EXPOSURE */
  codExposurePct: 60,
  /** Net margin below this % triggers DECLINING_MARGIN */
  decliningMarginPct: 10,
  /** Minimum realized revenue required before margin alerts fire */
  minRevenueForAlerts: 1000,
} as const;

// ─── Fetch function ──────────────────────────────────────────────────────────

async function fetchAlerts(organizationId: string): Promise<Alert[]> {
  // Single aggregation query — grouped by type, status, and fulfillmentStatus
  const grouped = await prisma.transaction.groupBy({
    by: ["type", "status", "fulfillmentStatus"],
    where: { organizationId },
    _sum: { amount: true },
    _count: { id: true },
  });

  let totalIncomeOrders = 0;
  let returnedOrders = 0;
  let realizedRevenue = 0;
  let pendingEscrow = 0;  // COD/PENDING INCOME
  let returnedRevenue = 0;   // RETURNED INCOME that was already counted
  let totalExpenses = 0;

  grouped.forEach((g) => {
    const amt = Number(g._sum.amount || 0);
    const count = g._count.id;

    if (g.type === "INCOME") {
      totalIncomeOrders += count;
      if (g.fulfillmentStatus === "RETURNED") {
        returnedOrders += count;
        returnedRevenue += amt;
      }
      if (g.status === "RECEIVED" && g.fulfillmentStatus !== "RETURNED") {
        realizedRevenue += amt;
      }
      if (g.status === "PENDING") {
        pendingEscrow += amt;
      }
    } else if (g.type === "EXPENSE") {
      totalExpenses += amt;
    }
  });

  const netProfit = realizedRevenue - totalExpenses;
  const marginPct = realizedRevenue > 0 ? (netProfit / realizedRevenue) * 100 : 0;
  const returnRatePct = totalIncomeOrders > 0 ? (returnedOrders / totalIncomeOrders) * 100 : 0;
  const codExposurePct = realizedRevenue > 0 ? (pendingEscrow / realizedRevenue) * 100 : 0;

  const alerts: Alert[] = [];

  // ── Rule 1: High Return Rate ─────────────────────────────────────────────────
  if (returnRatePct > THRESHOLDS.returnRatePct && totalIncomeOrders >= 5) {
    alerts.push({
      id: "HIGH_RETURN_RATE",
      severity: "critical",
      title: "High Return Rate",
      message: `${Math.round(returnRatePct)}% of your orders have been returned. This directly erodes your realized revenue and signals a product-market fit or logistics issue.`,
      metric: `${Math.round(returnRatePct)}% returns`,
    });
  }

  // ── Rule 2: Negative Profitability ──────────────────────────────────────────
  if (netProfit < 0 && realizedRevenue > THRESHOLDS.minRevenueForAlerts) {
    const loss = Math.abs(netProfit);
    alerts.push({
      id: "NEGATIVE_PROFITABILITY",
      severity: "critical",
      title: "Operating at a Loss",
      message: `You are currently spending more than you earn. Net loss is ${loss.toLocaleString("en-EG")} EGP. Cut costs or boost prices immediately.`,
      metric: `-${loss.toLocaleString("en-EG")} EGP`,
    });
  }

  // ── Rule 3: Excessive COD Exposure ──────────────────────────────────────────
  if (codExposurePct > THRESHOLDS.codExposurePct && pendingEscrow > 0) {
    alerts.push({
      id: "EXCESSIVE_COD_EXPOSURE",
      severity: "warning",
      title: "Excessive COD Exposure",
      message: `${Math.round(codExposurePct)}% of your revenue (${pendingEscrow.toLocaleString("en-EG")} EGP) is still pending with couriers. Follow up on deliveries to realize this cash.`,
      metric: `${Math.round(codExposurePct)}% pending`,
    });
  }

  // ── Rule 4: Declining Margin ─────────────────────────────────────────────────
  if (
    marginPct > 0 &&
    marginPct < THRESHOLDS.decliningMarginPct &&
    realizedRevenue > THRESHOLDS.minRevenueForAlerts
  ) {
    alerts.push({
      id: "DECLINING_MARGIN",
      severity: "warning",
      title: "Thin Profit Margins",
      message: `Your net margin is only ${Math.round(marginPct)}%. A single returned order or unexpected expense could push you into the red. Review your cost structure.`,
      metric: `${Math.round(marginPct)}% margin`,
    });
  }

  // ── Rule 5: Returned Revenue ────────────────────────────────────────────────────
  if (returnedRevenue > 0) {
    alerts.push({
      id: "RETURNED",
      severity: "info",
      title: "Returned Revenue Detected",
      message: `${returnedRevenue.toLocaleString("en-EG")} EGP in returned orders may have been previously counted as income. Ensure these are marked as RETURNED in your records.`,
      metric: `${returnedRevenue.toLocaleString("en-EG")} EGP`,
    });
  }

  return alerts;
}

// ─── Exported action ─────────────────────────────────────────────────────────

import { verifyOrgAccess } from "@/lib/auth";

export async function getAlerts(organizationId: string): Promise<Alert[]> {
  await verifyOrgAccess(organizationId);

  const getCached = unstable_cache(
    async () => fetchAlerts(organizationId),
    ["alerts", organizationId],
    {
      tags: [`org-${organizationId}-transactions`],
      revalidate: 1800, // 30 minutes — alerts don't need to be real-time
    }
  );
  return getCached();
}

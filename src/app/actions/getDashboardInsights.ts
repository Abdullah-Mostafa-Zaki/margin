"use server";

import prisma from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardInsights {
  mainText: string;
  actionText: string;
  escrowText: string | null;
  /** Tailwind background, border, and text classes combined */
  colorClass: string;
  
  totalOrders: number;
  realizedRevenue: number;
  totalExpenses: number;
  netProfit: number;
  adSpend: number;
  pendingEscrow: number;
  returnedRevenue: number;
  excelBullets: string[];
  expenseSubtitle: string;
  marginPct: number;
  rawPercent: number;
  ordersToBreakeven: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-EG")} EGP`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

// ─── Main Action ──────────────────────────────────────────────────────────────

import { unstable_cache } from 'next/cache';

async function fetchDashboardInsights(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<DashboardInsights> {
    const dateFilter = startDate && endDate ? {
    date: {
      gte: startDate,
      lte: endDate,
    },
    OR: [
      { dateConfidence: "CONFIRMED" as any },
      { 
        dateConfidence: "ESTIMATED" as any,
        estimatedRangeStart: { gte: startDate },
        estimatedRangeEnd: { lte: endDate },
      }
    ]
  } : {};

  const tagFilter = tagId ? { 
    drops: { some: { dropId: tagId } }
  } : {};

  // Fetch grouped transactions to leverage SQL aggregation and save memory
  const groupedTransactions = await prisma.transaction.groupBy({
    by: ['type', 'status', 'category', 'fulfillmentStatus'],
    where: {
      organizationId,
      ...dateFilter,
      ...tagFilter,
    },
    _sum: {
      amount: true,
      shipmentFee: true,
    },
    _count: {
      id: true,
    },
  });

  // ─── Calculations ──────────────────────────────────────────────────────────

  let realizedRevenue = 0;
  let pendingEscrow = 0;
  let returnedRevenue = 0;
  let manualExpenses = 0;
  let shippingCosts = 0;
  let adSpend = 0;
  let totalOrders = 0;
  const expenseByCategory: Record<string, number> = {};

  groupedTransactions.forEach((group) => {
    const sumAmount = Number(group._sum.amount || 0);
    const sumShipment = Number(group._sum.shipmentFee || 0);

    if (group.type === "INCOME") {
      if (group.status === "RECEIVED") {
        realizedRevenue += sumAmount;
      }
      if (group.status === "PENDING") {
        pendingEscrow += sumAmount;
      }
      if (group.fulfillmentStatus === "RETURNED") {
        returnedRevenue += sumAmount;
      }
      if (sumShipment > 0) {
        shippingCosts += sumShipment;
      }
      
      // God Metric Denominator
      if (group.status === "RECEIVED" && group.category.toLowerCase() === "sales revenue") {
        totalOrders += group._count.id;
      }
    } else if (group.type === "EXPENSE") {
      manualExpenses += sumAmount;

      // Ad Spend
      const catLower = group.category.toLowerCase();
      if (catLower === "ads" || catLower === "marketing" || catLower === "ad spend") {
        adSpend += sumAmount;
      }

      // Expense Breakdown
      expenseByCategory[group.category] = (expenseByCategory[group.category] || 0) + sumAmount;
    }
  });

  const totalExpenses = manualExpenses + shippingCosts;

  if (shippingCosts > 0) {
    expenseByCategory["Shipping"] = (expenseByCategory["Shipping"] || 0) + shippingCosts;
  }

  let topExpenseCategory: { category: string; pct: number } | null = null;
  if (totalExpenses > 0) {
    const sortedExpenses = Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]);
    if (sortedExpenses.length > 0) {
      topExpenseCategory = {
        category: sortedExpenses[0][0],
        pct: (sortedExpenses[0][1] / totalExpenses) * 100
      };
    }
  }

  // 8. Net Profit
  const netProfit = realizedRevenue - totalExpenses;

  // 9. Margin % (guard against division by zero)
  const marginPct =
    realizedRevenue > 0 ? (netProfit / realizedRevenue) * 100 : 0;

  // 10. Ad Spend % (guard against division by zero)
  const adSpendPct =
    realizedRevenue > 0 ? (adSpend / realizedRevenue) * 100 : 0;

  // 11. Raw Materials %
  const rawExpense = expenseByCategory["Raw Materials"] || 0;
  const rawPercent = totalExpenses > 0 ? (rawExpense / totalExpenses) * 100 : 0;

  // 12. Orders to Breakeven
  const averageOrderValue = totalOrders > 0 ? realizedRevenue / totalOrders : 0;
  const ordersToBreakeven = netProfit < 0 && averageOrderValue > 0 
    ? Math.ceil(Math.abs(netProfit) / averageOrderValue) 
    : 0;

  // ─── Formatted values ──────────────────────────────────────────────────────

  const fRevenue = formatCurrency(realizedRevenue);
  const fEscrow = formatCurrency(pendingEscrow);
  const fNetProfit = formatCurrency(netProfit);
  const fMargin = formatPercent(marginPct);
  const fAdPct = formatPercent(adSpendPct);

  // ─── Excel Bullets ────────────────────────────────────────────────────────
  const excelBullets: string[] = [];
  excelBullets.push(`You generated ${fRevenue} in top-line revenue, but your actual take-home profit is only ${fNetProfit}.`);
  if (adSpend > 0) {
    excelBullets.push(`You spent ${formatCurrency(adSpend)} to acquire these sales.`);
  }
  if (pendingEscrow > 0) {
    excelBullets.push(`You have ${fEscrow} floating with couriers right now.`);
  }

  // ─── Expense Chart Subtitle ───────────────────────────────────────────────
  let expenseSubtitle = "";
  if (topExpenseCategory && topExpenseCategory.pct > 70 && topExpenseCategory.category.toLowerCase() === "raw materials") {
    expenseSubtitle = "Raw materials dominate your costs. Negotiate bulk pricing.";
  } else if (adSpendPct > 40) {
    expenseSubtitle = "Ads are consuming a massive portion of revenue. Drill down on ROAS.";
  } else if (topExpenseCategory) {
    expenseSubtitle = `${topExpenseCategory.category} is your highest expense at ${Math.round(topExpenseCategory.pct)}%. Monitor closely.`;
  }

  // ─── Escrow Text (universal rule) ─────────────────────────────────────────

  let escrowText: string | null = null;
  if (pendingEscrow > realizedRevenue) {
    escrowText = `Most of your money (${fEscrow}) is still uncollected. Focus on delivery success rate.`;
  } else if (pendingEscrow > 0) {
    escrowText = `You also have ${fEscrow} waiting with couriers.`;
  }

  // ─── Insight Rules (evaluated in strict order) ────────────────────────────

  let mainText = "";
  let actionText = "";
  let colorClass = "";

  // Rule 1: No revenue
  if (realizedRevenue === 0) {
    mainText = "No revenue found for this period.";
    actionText = "Start generating sales to see actionable insights.";
    colorClass = "bg-zinc-50 border-zinc-200 text-zinc-900";
  }
  // Rule 2: Losing money
  else if (netProfit < 0) {
    mainText = `You made ${fRevenue} revenue, but you're losing money.`;
    actionText = adSpendPct > 30
      ? `Ads are eating ${fAdPct} of it. Reduce acquisition costs.`
      : "Cut costs immediately to reach profitability.";
    colorClass = "bg-rose-50 border-rose-200 text-rose-900";
  }
  // Rule 3: Warning state (low profitability or high ad spend)
  else if (marginPct > 0 && marginPct <= 15) {
    mainText = `You made ${fNetProfit} true profit. Your margins are tight at ${fMargin}.`;
    actionText = adSpendPct > 20
      ? `Watch your acquisition costs. Ads represent ${fAdPct} of revenue.`
      : "Increase prices or reduce costs.";
    colorClass = "bg-amber-50 border-amber-200 text-amber-900";
  }
  // Rule 4: Green State (Healthy)
  else {
    mainText = `You made ${fNetProfit} in true profit. Your margins are healthy at ${fMargin}.`;
    actionText = "Keep it up. Focus on scaling what's working.";
    colorClass = "bg-emerald-50 border-emerald-200 text-emerald-900";
  }

  // Dynamic injection for expense ratios (e.g. Raw Materials > 70%)
  if (realizedRevenue > 0 && topExpenseCategory && topExpenseCategory.pct > 70 && topExpenseCategory.category.toLowerCase() === "raw materials") {
    actionText += ` Raw materials are taking up ${Math.round(topExpenseCategory.pct)}% of expenses. Check supplier pricing.`;
  }

  return {
    mainText,
    actionText,
    escrowText,
    colorClass,
    totalOrders,
    realizedRevenue,
    totalExpenses,
    netProfit,
    adSpend,
    pendingEscrow,
    returnedRevenue,
    excelBullets,
    expenseSubtitle,
    marginPct,
    rawPercent,
    ordersToBreakeven,
  };
}

export async function getDashboardInsights(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null,
  tagId?: string
): Promise<DashboardInsights> {
  const getCached = unstable_cache(
    async () => fetchDashboardInsights(organizationId, startDate, endDate, tagId),
    [
      'dashboard-insights',
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

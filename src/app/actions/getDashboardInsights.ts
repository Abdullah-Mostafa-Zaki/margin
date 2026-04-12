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
  pendingCOD: number;
  excelBullets: string[];
  expenseSubtitle: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `${Math.round(amount).toLocaleString("en-EG")} EGP`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

// ─── Main Action ──────────────────────────────────────────────────────────────

export async function getDashboardInsights(
  organizationId: string,
  startDate: Date | null,
  endDate: Date | null
): Promise<DashboardInsights> {

  const dateFilter = startDate && endDate ? {
    date: {
      gte: startDate,
      lte: endDate,
    }
  } : {};

  // Fetch all transactions for this org in the filtered date range
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      ...dateFilter,
    },
    select: {
      type: true,
      amount: true,
      status: true,
      category: true,
    },
  });

  // ─── Calculations ──────────────────────────────────────────────────────────

  // 1. Realized Revenue: INCOME where status === RECEIVED
  const realizedRevenue = transactions
    .filter((t) => t.type === "INCOME" && t.status === "RECEIVED")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // 2. Pending Escrow: INCOME where status === PENDING
  const pendingEscrow = transactions
    .filter((t) => t.type === "INCOME" && t.status === "PENDING")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // 3. Total Expenses: all EXPENSE transactions
  const totalExpenses = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // 4. Ad Spend: EXPENSE where category is "ads" or "marketing"
  const adSpend = transactions
    .filter(
      (t) =>
        t.type === "EXPENSE" &&
        (t.category.toLowerCase() === "ads" ||
          t.category.toLowerCase() === "marketing" ||
          t.category.toLowerCase() === "ad spend")
    )
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // 5. Total Orders (God Metric Denominator)
  const totalOrders = transactions.filter(
    (t) => 
      t.type === "INCOME" && 
      t.status === "RECEIVED" && 
      t.category.toLowerCase() === "sales revenue"
  ).length;

  // 6. Expense Breakdown & Top Category
  const expenseByCategory = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
      return acc;
    }, {} as Record<string, number>);

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

  // 7. Net Profit
  const netProfit = realizedRevenue - totalExpenses;

  // 8. Margin % (guard against division by zero)
  const marginPct =
    realizedRevenue > 0 ? (netProfit / realizedRevenue) * 100 : 0;

  // 9. Ad Spend % (guard against division by zero)
  const adSpendPct =
    realizedRevenue > 0 ? (adSpend / realizedRevenue) * 100 : 0;

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
    pendingCOD: pendingEscrow,
    excelBullets,
    expenseSubtitle,
  };
}

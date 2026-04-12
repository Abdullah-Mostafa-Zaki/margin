"use server";

import prisma from "@/lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardInsights {
  mainText: string;
  actionText: string;
  escrowText: string | null;
  /** Tailwind background, border, and text classes combined */
  colorClass: string;
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
  organizationId: string
): Promise<DashboardInsights> {
  // Current-month date boundaries
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Fetch all transactions for this org in the current month
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
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
          t.category.toLowerCase() === "marketing")
    )
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // 5. Net Profit
  const netProfit = realizedRevenue - totalExpenses;

  // 6. Margin % (guard against division by zero)
  const marginPct =
    realizedRevenue > 0 ? (netProfit / realizedRevenue) * 100 : 0;

  // 7. Ad Spend % (guard against division by zero)
  const adSpendPct =
    realizedRevenue > 0 ? (adSpend / realizedRevenue) * 100 : 0;

  // ─── Formatted values ──────────────────────────────────────────────────────

  const fRevenue = formatCurrency(realizedRevenue);
  const fEscrow = formatCurrency(pendingEscrow);
  const fProfit = formatCurrency(Math.abs(netProfit));
  const fNetProfit = formatCurrency(netProfit);
  const fMargin = formatPercent(marginPct);
  const fAdPct = formatPercent(adSpendPct);

  // ─── Escrow Text (universal rule) ─────────────────────────────────────────

  let escrowText: string | null = null;
  if (pendingEscrow > realizedRevenue) {
    escrowText = `Most of your money (${fEscrow}) is still uncollected. Focus on delivery success rate.`;
  } else if (pendingEscrow > 0) {
    escrowText = `You also have ${fEscrow} waiting with couriers.`;
  }

  // ─── Insight Rules (evaluated in strict order) ────────────────────────────

  // Rule 1: No revenue
  if (realizedRevenue === 0) {
    return {
      mainText: "No revenue yet this month.",
      actionText: "Start generating sales to see insights.",
      escrowText,
      colorClass: "bg-gray-100 border-gray-200 text-gray-800",
    };
  }

  // Rule 2: Low data
  if (realizedRevenue < 5000) {
    return {
      mainText: "Data is still limited this month.",
      actionText: "More sales are needed for accurate insights.",
      escrowText,
      colorClass: "bg-gray-100 border-gray-200 text-gray-800",
    };
  }

  // Rule 3: Losing money
  if (netProfit < 0) {
    const actionText =
      adSpendPct > 30
        ? `Ads are taking ${fAdPct} of your revenue. Reduce ad spend or improve conversion now.`
        : "Your costs are too high. Reduce expenses or increase pricing.";

    return {
      mainText: `You made ${fRevenue} but lost ${fProfit}.`,
      actionText,
      escrowText,
      colorClass: "bg-red-50 border-red-200 text-red-900",
    };
  }

  // Rule 4: Low profitability (0% – 15%)
  if (marginPct >= 0 && marginPct <= 15) {
    const actionText =
      adSpendPct > 20
        ? `Ad spend is high at ${fAdPct}. Watch your acquisition costs.`
        : "Margins are tight. Increase prices or reduce costs.";

    return {
      mainText: `You made ${fRevenue} but kept only ${fNetProfit} (${fMargin} margin).`,
      actionText,
      escrowText,
      colorClass: "bg-yellow-50 border-yellow-200 text-yellow-900",
    };
  }

  // Rule 5: Strong profitability (> 15%)
  return {
    mainText: `You made ${fNetProfit} in profit (${fMargin} margin).`,
    actionText: "This is working. Focus on scaling what's already bringing results.",
    escrowText,
    colorClass: "bg-green-50 border-green-200 text-green-900",
  };
}

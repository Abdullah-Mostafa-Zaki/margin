import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface AnalyticsPayload {
  metrics: Record<string, any>;
  benchmarks: Record<string, any>;
  trends: Record<string, any>;
  alerts: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

// Helper to convert Decimal to number safely
const toNumber = (val: any) => (val ? Number(val) : 0);

export async function calculateRevenueMetrics(orgId: string, startDate: Date, endDate: Date) {
  const result = await prisma.transaction.aggregate({
    where: {
      organizationId: orgId,
      date: { gte: startDate, lte: endDate },
      type: "INCOME",
      status: "RECEIVED",
    },
    _sum: { amount: true },
    _count: { id: true },
  });

  return {
    revenue: toNumber(result._sum.amount),
    transactionCount: result._count.id,
  };
}

export async function calculateExpenseMetrics(orgId: string, startDate: Date, endDate: Date, totalRevenue: number) {
  const result = await prisma.transaction.aggregate({
    where: {
      organizationId: orgId,
      date: { gte: startDate, lte: endDate },
      type: "EXPENSE",
    },
    _sum: { amount: true },
  });

  const categoryResult = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      organizationId: orgId,
      date: { gte: startDate, lte: endDate },
      type: "EXPENSE",
    },
    _sum: { amount: true },
  });

  const expenses = toNumber(result._sum.amount);
  
  const logisticsSum = categoryResult.find((c) => c.category === "Logistics (Shipping)")?._sum.amount;
  const adSum = categoryResult.find((c) => c.category === "Ads")?._sum.amount;

  const logisticsSpend = toNumber(logisticsSum);
  const adSpend = toNumber(adSum);

  return {
    expenses,
    logisticsSpend,
    logisticsSpendRatio: totalRevenue > 0 ? logisticsSpend / totalRevenue : 0,
    adSpend,
    adSpendRatio: totalRevenue > 0 ? adSpend / totalRevenue : 0,
  };
}

export async function calculateCodMetrics(orgId: string, startDate: Date, endDate: Date, totalRevenue: number) {
  const result = await prisma.transaction.aggregate({
    where: {
      organizationId: orgId,
      date: { gte: startDate, lte: endDate },
      type: "INCOME",
      paymentMethod: "COD",
      status: "PENDING",
    },
    _sum: { amount: true },
  });

  const pendingCod = toNumber(result._sum.amount);

  return {
    pendingCodBalance: pendingCod,
    codRatio: totalRevenue > 0 ? pendingCod / totalRevenue : 0,
  };
}

export async function calculateProductMetrics(orgId: string, startDate: Date, endDate: Date) {
  const allProducts = await prisma.lineItem.groupBy({
    by: ["name"],
    where: {
      transaction: {
        organizationId: orgId,
        date: { gte: startDate, lte: endDate },
        type: "INCOME",
        status: "RECEIVED",
      },
    },
    _sum: { price: true, quantity: true },
    orderBy: { _sum: { price: "desc" } },
  });

  const formattedProducts = allProducts.map((p) => ({
    name: p.name,
    revenue: toNumber(p._sum.price),
    quantity: p._sum.quantity || 0,
  }));

  const totalProductRevenue = formattedProducts.reduce((sum, p) => sum + p.revenue, 0);
  const top20PercentCount = Math.max(1, Math.ceil(formattedProducts.length * 0.2));
  const top20Revenue = formattedProducts.slice(0, top20PercentCount).reduce((sum, p) => sum + p.revenue, 0);

  return {
    topProducts: formattedProducts.slice(0, 5),
    activeProductCount: formattedProducts.length,
    productConcentrationPercent: totalProductRevenue > 0 && formattedProducts.length > 0 ? formattedProducts[0].revenue / totalProductRevenue : 0,
    paretoTop20RevenuePercent: totalProductRevenue > 0 ? top20Revenue / totalProductRevenue : 0,
  };
}

export async function calculateFulfillmentEfficiency(orgId: string, startDate: Date, endDate: Date) {
  const deliveredTxs = await prisma.transaction.findMany({
    where: {
      organizationId: orgId,
      date: { gte: startDate, lte: endDate },
      type: "INCOME",
      fulfillmentStatus: "DELIVERED"
    },
    select: { createdAt: true, updatedAt: true, bostaLastSyncedAt: true }
  });

  if (deliveredTxs.length === 0) return { avgFulfillmentDays: 0 };

  let totalDays = 0;
  for (const tx of deliveredTxs) {
    const end = tx.bostaLastSyncedAt || tx.updatedAt;
    const diff = (end.getTime() - tx.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    totalDays += Math.max(0, diff);
  }

  return { avgFulfillmentDays: totalDays / deliveredTxs.length };
}

export async function calculateCostStructure(orgId: string, startDate: Date, endDate: Date) {
  const expenses = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      organizationId: orgId,
      date: { gte: startDate, lte: endDate },
      type: "EXPENSE",
    },
    _sum: { amount: true },
  });

  let fixedCosts = 0;
  let variableCosts = 0;
  let taxesAndLegal = 0;
  const expenseBreakdown: Record<string, number> = {};

  const fixedCategories = ["Facilities", "Subscriptions", "Salaries"];
  const variableCategories = ["Ads", "Logistics (Shipping)", "Returns & Refunds", "Raw Materials", "Manufacturing", "Packaging", "Content Creation"];

  for (const exp of expenses) {
    const amt = toNumber(exp._sum.amount);
    expenseBreakdown[exp.category] = amt;

    if (fixedCategories.includes(exp.category)) fixedCosts += amt;
    else if (variableCategories.includes(exp.category)) variableCosts += amt;
    
    if (exp.category === "Taxes & Legal") taxesAndLegal += amt;
  }

  return {
    fixedCosts,
    variableCosts,
    taxesAndLegal,
    expenseBreakdown,
  };
}

export async function calculateDropRoi(orgId: string, startDate: Date, endDate: Date) {
  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId: orgId,
      date: { gte: startDate, lte: endDate },
    },
    include: { tags: { include: { tag: true } } }
  });

  const tagStats: Record<string, { revenue: number, profit: number }> = {};

  for (const tx of transactions) {
    for (const t of tx.tags) {
      const tagName = t.tag.name;
      if (!tagStats[tagName]) tagStats[tagName] = { revenue: 0, profit: 0 };
      
      const amt = toNumber(tx.amount);
      if (tx.type === "INCOME") {
        tagStats[tagName].revenue += amt;
        tagStats[tagName].profit += amt;
      } else {
        tagStats[tagName].profit -= amt;
      }
    }
  }

  const dropRoi = Object.entries(tagStats).map(([name, stats]) => ({
    name,
    revenue: stats.revenue,
    profit: stats.profit,
    roiPercent: stats.revenue > 0 ? stats.profit / stats.revenue : 0
  })).sort((a, b) => b.profit - a.profit);

  return {
    dropRoi,
    bestDrop: dropRoi.length > 0 ? dropRoi[0] : null,
    worstDrop: dropRoi.length > 0 ? dropRoi[dropRoi.length - 1] : null,
  };
}

export async function calculateReturnStatusCount(orgId: string, startDate: Date, endDate: Date) {
  const count = await prisma.transaction.count({
    where: {
      organizationId: orgId,
      date: { gte: startDate, lte: endDate },
      type: "INCOME",
      fulfillmentStatus: "RETURNED",
    }
  });
  return { returnedStatusCount: count };
}


export async function calculateHistoricalBenchmarks(orgId: string, endDate: Date) {
  const ninetyDaysAgo = new Date(endDate);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get total revenue for 90 days
  const revAgg = await prisma.transaction.aggregate({
    where: {
      organizationId: orgId,
      date: { gte: ninetyDaysAgo, lte: endDate },
      type: "INCOME",
      status: "RECEIVED",
    },
    _sum: { amount: true },
  });

  const totalRev90 = toNumber(revAgg._sum.amount);

  // Get total expenses for 90 days
  const expAgg = await prisma.transaction.aggregate({
    where: {
      organizationId: orgId,
      date: { gte: ninetyDaysAgo, lte: endDate },
      type: "EXPENSE",
    },
    _sum: { amount: true },
  });
  const totalExp90 = toNumber(expAgg._sum.amount);

  // Get category totals
  const categoryAgg = await prisma.transaction.groupBy({
    by: ["category"],
    where: {
      organizationId: orgId,
      date: { gte: ninetyDaysAgo, lte: endDate },
      type: "EXPENSE",
    },
    _sum: { amount: true },
  });

  const logistics90 = toNumber(categoryAgg.find((c) => c.category === "Logistics (Shipping)")?._sum.amount);

  // Get returns for 90 days
  const returnsAgg = await prisma.transaction.aggregate({
    where: {
      organizationId: orgId,
      date: { gte: ninetyDaysAgo, lte: endDate },
      type: "EXPENSE",
      category: "Returns & Refunds",
    },
    _sum: { amount: true },
  });

  const returns90 = toNumber(returnsAgg._sum.amount);

  // Get COD for 90 days
  const codAgg = await prisma.transaction.aggregate({
    where: {
      organizationId: orgId,
      date: { gte: ninetyDaysAgo, lte: endDate },
      type: "INCOME",
      paymentMethod: "COD",
    },
    _sum: { amount: true },
  });

  const cod90 = toNumber(codAgg._sum.amount);

  return {
    avgMargin: totalRev90 > 0 ? (totalRev90 - totalExp90) / totalRev90 : 0,
    avgLogisticsRatio: totalRev90 > 0 ? logistics90 / totalRev90 : 0,
    avgCodRatio: totalRev90 > 0 ? cod90 / totalRev90 : 0,
    avgReturnRate: totalRev90 > 0 ? returns90 / totalRev90 : 0,
  };
}

export function generateHealthAlerts(
  metrics: any,
  benchmarks: any,
  trends: any
): string[] {
  const alerts: string[] = [];

  if (metrics.logisticsSpendRatio > benchmarks.avgLogisticsRatio * 1.3 && benchmarks.avgLogisticsRatio > 0) {
    alerts.push(`Logistics costs are ${( (metrics.logisticsSpendRatio / benchmarks.avgLogisticsRatio - 1) * 100 ).toFixed(0)}% above historical average.`);
  }

  if (metrics.codRatio > 0.3) {
    alerts.push(`COD escrow exceeds ${(metrics.codRatio * 100).toFixed(0)}% of realized revenue.`);
  }

  if (trends.marginTrend < -0.1) {
    alerts.push(`Net margin declined ${(Math.abs(trends.marginTrend) * 100).toFixed(0)}% versus prior period.`);
  }

  if (metrics.productConcentrationPercent > 0.5) {
    alerts.push(`One product generated ${(metrics.productConcentrationPercent * 100).toFixed(0)}% of total revenue.`);
  }

  return alerts;
}

export function calculateConfidenceScore(
  revenue: number,
  transactionCount: number,
  daysOfData: number // approximate days of historical data available
): "HIGH" | "MEDIUM" | "LOW" {
  if (transactionCount < 10 || revenue === 0 || daysOfData < 14) {
    return "LOW";
  }
  if (transactionCount > 50 && daysOfData >= 60) {
    return "HIGH";
  }
  return "MEDIUM";
}

export async function generateAnalyticsPayload(
  orgId: string,
  startDate: Date,
  endDate: Date,
  reportType: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY"
): Promise<AnalyticsPayload> {
  const priorStartDate = new Date(startDate);
  const periodDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  priorStartDate.setDate(priorStartDate.getDate() - periodDays);

  const [
    rev, 
    priorRev, 
    benchmarks, 
    returnStats
  ] = await Promise.all([
    calculateRevenueMetrics(orgId, startDate, endDate),
    calculateRevenueMetrics(orgId, priorStartDate, startDate),
    calculateHistoricalBenchmarks(orgId, endDate),
    calculateReturnStatusCount(orgId, startDate, endDate)
  ]);

  let product = {}, fulfillment = {}, costStructure = {}, dropRoi = {};

  const specificPromises = [];
  
  if (reportType === "WEEKLY") {
    specificPromises.push(calculateDropRoi(orgId, startDate, endDate).then(r => dropRoi = r));
  }
  
  if (reportType === "MONTHLY") {
    specificPromises.push(calculateFulfillmentEfficiency(orgId, startDate, endDate).then(r => fulfillment = r));
  }
  
  if (reportType === "QUARTERLY") {
    specificPromises.push(calculateProductMetrics(orgId, startDate, endDate).then(r => product = r));
    specificPromises.push(calculateCostStructure(orgId, startDate, endDate).then(r => costStructure = r));
  }

  if (reportType === "YEARLY") {
    specificPromises.push(calculateCostStructure(orgId, startDate, endDate).then(r => costStructure = r));
  }

  await Promise.all(specificPromises);

  const expensesData = await calculateExpenseMetrics(orgId, startDate, endDate, rev.revenue);
  const priorExpensesData = await calculateExpenseMetrics(orgId, priorStartDate, startDate, priorRev.revenue);
  const codData = await calculateCodMetrics(orgId, startDate, endDate, rev.revenue);

  const profit = rev.revenue - expensesData.expenses;
  const marginPercent = rev.revenue > 0 ? profit / rev.revenue : 0;

  const priorProfit = priorRev.revenue - priorExpensesData.expenses;
  const priorMarginPercent = priorRev.revenue > 0 ? priorProfit / priorRev.revenue : 0;

  const trends = {
    revenueGrowthPercent: priorRev.revenue > 0 ? (rev.revenue - priorRev.revenue) / priorRev.revenue : 0,
    profitGrowthPercent: priorProfit > 0 ? (profit - priorProfit) / Math.abs(priorProfit) : 0,
    marginTrend: marginPercent - priorMarginPercent, // absolute diff in percent
    priorRevenue: priorRev.revenue,
    priorProfit: priorProfit,
    priorMarginPercent,
  };

  const metrics = {
    ...rev,
    ...expensesData,
    profit,
    marginPercent,
    ...codData,
    ...product,
    ...fulfillment,
    ...costStructure,
    ...dropRoi,
    ...returnStats,
  };

  // Check days of data for confidence score
  const firstTx = await prisma.transaction.findFirst({
    where: { organizationId: orgId },
    orderBy: { date: "asc" },
  });
  
  let daysOfData = 0;
  if (firstTx) {
    daysOfData = (endDate.getTime() - firstTx.date.getTime()) / (1000 * 60 * 60 * 24);
  }

  const confidence = calculateConfidenceScore(rev.revenue, rev.transactionCount, daysOfData);

  const alerts = generateHealthAlerts(metrics, benchmarks, trends);

  return {
    metrics,
    benchmarks,
    trends,
    alerts,
    confidence,
  };
}

import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AnalyticsShell } from "@/components/analytics/analytics-shell";
import { PageTracker } from "@/components/analytics/PageTracker";
import { DropFilter } from "@/components/analytics/drop-filter";
import { GenerateReportModal } from "@/components/analytics/generate-report-modal";
import { PLAN_LIMITS } from "@/lib/plans";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { getDateRangeFromParams } from "@/lib/date-utils";
import { groupTransactionsByDate } from "@/lib/chart-utils";
import { getDashboardInsights } from "@/app/actions/getDashboardInsights";
import { getAnalyticsVelocity } from "@/app/actions/getAnalyticsVelocity";
import { getDropPerformance } from "@/app/actions/getDropPerformance";
import { getOrderFunnel } from "@/app/actions/getOrderFunnel";
import { getReturnsByCity } from "@/app/actions/getReturnsByCity";
import { getMarketingMetrics } from "@/app/actions/getMarketingMetrics";
export default async function AnalyticsPage(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await props.params;
  const resolvedSearchParams = await props.searchParams;

  const organization = await prisma.organization.findUnique({
    where: { slug: resolvedParams.orgSlug },
    select: { 
      id: true,
      slug: true,
      plan: true,
    }
  });
  if (!organization) {
    const headersList = await headers();
    const referer = headersList.get("referer");
    const fromPath = referer ? new URL(referer).pathname : "/";
    redirect(`/unauthorized?from=${encodeURIComponent(fromPath)}`);
  }

  const limits = PLAN_LIMITS[organization.plan];
  const hasShopifyAnalytics = limits.shopifyAnalytics;
  const hasAdvancedAnalytics = limits.advancedAnalytics;

  const { startDate, endDate } = getDateRangeFromParams(resolvedSearchParams);
  const dateFilter = startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {};
  const isAllTime = !startDate && !endDate;
  const subtitleText = isAllTime ? "vs last month" : "vs prev period";

  const tagId = typeof resolvedSearchParams.tagId === "string" ? resolvedSearchParams.tagId : undefined;
  const tagFilter = tagId ? { 
    OR: [
      { dropId: tagId },
      { drops: { some: { dropId: tagId } } }
    ]
  } : {};

  const tags = await prisma.drop.findMany({
    where: { organizationId: organization.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  // Insights is now the SINGLE SOURCE OF TRUTH for top-level KPIs
  const [
    insights,
    velocity,
    dropPerformance,
    orderFunnel,
    returnsByCity,
    marketing,
    dailyTransactions,
    expenseByCategory,
    lineItems
  ] = await Promise.all([
    getDashboardInsights(organization.id, startDate, endDate, tagId),
    getAnalyticsVelocity(organization.id, startDate, endDate, tagId),
    getDropPerformance(organization.id, startDate, endDate, tagId),
    getOrderFunnel(organization.id, startDate, endDate, tagId),
    getReturnsByCity(organization.id, startDate, endDate, tagId),
    getMarketingMetrics(organization.id, startDate || undefined, endDate || undefined, tagId),
    prisma.transaction.findMany({
      where: { organizationId: organization.id, status: 'RECEIVED', ...dateFilter, ...tagFilter },
      select: { date: true, type: true, amount: true },
      orderBy: { date: 'asc' }
    }),
    prisma.transaction.groupBy({
      by: ['category'],
      where: { organizationId: organization.id, type: 'EXPENSE', status: 'RECEIVED', ...dateFilter, ...tagFilter },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } }
    }),
    prisma.lineItem.findMany({
      where: {
        transaction: {
          organizationId: organization.id,
          type: 'INCOME',
          status: 'RECEIVED',
          ...dateFilter,
          ...tagFilter
        }
      }
    })
  ]);

  const baseChartData = groupTransactionsByDate(dailyTransactions);
  const chartDataMap: Record<string, any> = {};
  
  baseChartData.forEach((d: any) => {
    chartDataMap[d.date] = { ...d, adSpend: 0 };
  });

  marketing.adSpendByDate.forEach((tx: any) => {
    const dateKey = new Date(tx.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (chartDataMap[dateKey]) {
      chartDataMap[dateKey].adSpend += tx.amount;
    } else {
      chartDataMap[dateKey] = { date: dateKey, income: 0, expenses: 0, adSpend: tx.amount };
    }
  });

  const chartData = Object.values(chartDataMap);

  const donutData = expenseByCategory.map((e: any) => ({
    category: e.category,
    amount: Number(e._sum.amount || 0)
  }));

  const productData: Record<string, { name: string, revenue: number }> = {};
  let totalLineItemRevenue = 0;

  lineItems.forEach((item: any) => {
    const rev = item.quantity * Number(item.price);
    const key = item.sku || item.name;
    
    if (!productData[key]) {
      productData[key] = { name: item.name, revenue: 0 };
    }
    productData[key].revenue += rev;
    totalLineItemRevenue += rev;
  });

  let productBreakdown: { name: string; revenue: number; percent: number }[] = [];

  if (totalLineItemRevenue > 0) {
    const sortedProducts = Object.values(productData).sort((a, b) => b.revenue - a.revenue);
    productBreakdown = sortedProducts.slice(0, 4).map((p) => ({
      name: p.name,
      revenue: p.revenue,
      percent: Math.round((p.revenue / totalLineItemRevenue) * 100)
    }));
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 overflow-y-auto pb-24">
      <PageTracker feature="Analytics" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Analytics</h1>
          <p className="text-zinc-500 md:mt-1 mt-2">Breakdown of your revenue and costs</p>
        </div>
        <div className="flex items-center gap-2">
          <GenerateReportModal orgSlug={organization.slug} plan={organization.plan} />
          <DropFilter tags={tags} currentTagId={tagId} />
          <DateRangePicker />
        </div>
      </div>

      <AnalyticsShell
        insights={insights}
        velocity={velocity}
        dropPerformance={dropPerformance}
        orderFunnel={orderFunnel}
        returnsByCity={returnsByCity}
        marketing={marketing}
        chartData={chartData}
        donutData={donutData}
        productBreakdown={productBreakdown}
        subtitleText={subtitleText}
        hasShopifyAnalytics={hasShopifyAnalytics}
        hasAdvancedAnalytics={hasAdvancedAnalytics}
      />
    </div>
  );
}

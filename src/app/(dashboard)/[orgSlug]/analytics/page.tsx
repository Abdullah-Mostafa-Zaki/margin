import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Clock, Activity } from "lucide-react";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { getDateRangeFromParams } from "@/lib/date-utils";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { ExpenseDonutChart } from "@/components/dashboard/expense-donut-chart";
import { groupTransactionsByDate } from "@/lib/chart-utils";
import { getDashboardInsights } from "@/app/actions/getDashboardInsights";
import { getAnalyticsVelocity } from "@/app/actions/getAnalyticsVelocity";
import { getDropPerformance } from "@/app/actions/getDropPerformance";
import { getOrderFunnel } from "@/app/actions/getOrderFunnel";
import { getReturnsByCity } from "@/app/actions/getReturnsByCity";
import { getMarketingMetrics } from "@/app/actions/getMarketingMetrics";
import { VelocityBadge } from "@/components/dashboard/velocity-badge";
import { DropPerformanceTable } from "@/components/dashboard/drop-performance-table";
import { OrderHealthFunnel } from "@/components/dashboard/order-health-funnel";
import { ReturnsByCity } from "@/components/dashboard/returns-by-city";
import { FadeIn } from "@/components/ui/fade-in";
import { UpgradeOverlay } from "@/components/ui/upgrade-overlay";
import { PageTracker } from "@/components/analytics/PageTracker";
import { DropFilter } from "@/components/analytics/drop-filter";
import { GenerateReportModal } from "@/components/analytics/generate-report-modal";
import { PLAN_LIMITS } from "@/lib/plans";
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

  const productRevenue: Record<string, number> = {};
  let totalLineItemRevenue = 0;

  lineItems.forEach((item: any) => {
    const rev = item.quantity * Number(item.price);
    productRevenue[item.name] = (productRevenue[item.name] || 0) + rev;
    totalLineItemRevenue += rev;
  });

  let productBreakdown: { name: string; revenue: number; percent: number }[] = [];

  if (totalLineItemRevenue > 0) {
    const sortedProducts = Object.entries(productRevenue).sort((a, b) => b[1] - a[1]);
    productBreakdown = sortedProducts.slice(0, 4).map(([name, rev]) => ({
      name,
      revenue: rev,
      percent: Math.round((rev / totalLineItemRevenue) * 100)
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

      {/* Primary Health Indicator: Net Profit */}
      <FadeIn delay={0.05}>
        <Card className={`border-2 shadow-sm ${insights.netProfit >= 0 ? 'border-emerald-500 bg-emerald-100/50' : 'border-rose-500 bg-rose-100/50'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-sm md:text-base font-bold uppercase tracking-wider ${insights.netProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
              Net Profit
            </CardTitle>
            {insights.netProfit >= 0 ? <ArrowUpRight className="h-6 w-6 text-emerald-600" /> : <ArrowDownRight className="h-6 w-6 text-rose-600" />}
          </CardHeader>
          <CardContent>
            <div className={`text-4xl md:text-5xl font-bold tracking-tight ${insights.netProfit >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
              {insights.netProfit < 0 ? '-' : ''}EGP {Math.abs(insights.netProfit).toLocaleString()}
            </div>
            <VelocityBadge delta={velocity.netProfit} subtitleText={subtitleText} />
            <p className={`text-sm mt-2 font-medium ${insights.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              {insights.netProfit >= 0 ? 'Your true take-home profit' : 'You are currently operating at a loss'}
            </p>
          </CardContent>
        </Card>
      </FadeIn>

      {/* 6 Card KPI Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <FadeIn delay={0.1}>
          <Card className="border border-emerald-200 bg-emerald-50/50 h-full shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Realized Revenue</CardTitle>
              <ArrowUpRight className="h-5 w-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-emerald-950">
                EGP {insights.realizedRevenue.toLocaleString()}
              </div>
              <VelocityBadge delta={velocity.realizedRevenue} subtitleText={subtitleText} />
              <p className="text-xs text-emerald-700 mt-2 font-medium">Actual cash received</p>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Card className="border border-zinc-200 bg-zinc-50 h-full shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Total Expenses</CardTitle>
              <Activity className="h-5 w-5 text-zinc-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-zinc-950">
                EGP {insights.totalExpenses.toLocaleString()}
              </div>
              <VelocityBadge delta={velocity.totalExpenses} invert={true} subtitleText={subtitleText} />
              <p className="text-xs text-zinc-700 mt-2 font-medium">Manual entries & shipping costs</p>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.3}>
          <Card className="border border-amber-200 bg-amber-50/50 h-full shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-amber-900 uppercase tracking-wider">Pending Escrow</CardTitle>
              <Clock className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-amber-950">
                EGP {insights.pendingEscrow.toLocaleString()}
              </div>
              <VelocityBadge delta={velocity.pendingEscrow} subtitleText={subtitleText} />
              <p className="text-xs text-amber-700 mt-2 font-medium">Cash held by couriers / in transit.</p>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.4}>
          <Card className="border border-red-200 bg-red-50/50 h-full shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-red-900 uppercase tracking-wider">Ghost Revenue</CardTitle>
              <ArrowDownRight className="h-5 w-5 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight text-red-950">
                EGP {insights.ghostRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-red-700 mt-2 font-medium">Lost revenue from returned orders.</p>
            </CardContent>
          </Card>
        </FadeIn>

        {/* ROAS Card */}
        <FadeIn delay={0.5}>
          <UpgradeOverlay locked={!hasShopifyAnalytics} message="Upgrade to PLUS to unlock ROAS tracking">
          <Card className={`border h-full shadow-sm ${marketing.roas && marketing.roas > 3 ? 'border-emerald-200 bg-emerald-50/50' : marketing.roas && marketing.roas >= 1.5 ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-bold uppercase tracking-wider ${marketing.roas && marketing.roas > 3 ? 'text-emerald-900' : marketing.roas && marketing.roas >= 1.5 ? 'text-amber-900' : 'text-red-900'}`}>ROAS</CardTitle>
              {marketing.roas && marketing.roas > 3 ? <ArrowUpRight className="h-5 w-5 text-emerald-600" /> : <ArrowDownRight className="h-5 w-5 text-red-600" />}
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold tracking-tight ${marketing.roas && marketing.roas > 3 ? 'text-emerald-950' : marketing.roas && marketing.roas >= 1.5 ? 'text-amber-950' : 'text-red-950'}`}>
                {marketing.roas ? `${marketing.roas.toFixed(2)}x` : '—'}
              </div>
              {marketing.roas !== null && marketing.roasPrevious !== null && (
                <VelocityBadge 
                  delta={marketing.roasPrevious > 0 ? ((marketing.roas - marketing.roasPrevious) / marketing.roasPrevious) * 100 : 100} 
                  subtitleText={subtitleText} 
                />
              )}
              <p className={`text-xs mt-2 font-medium ${marketing.roas && marketing.roas > 3 ? 'text-emerald-700' : marketing.roas && marketing.roas >= 1.5 ? 'text-amber-700' : 'text-red-700'}`}>
                {marketing.roas ? 'Revenue per EGP spent on ads' : 'No ad spend logged'}
              </p>
            </CardContent>
          </Card>
          </UpgradeOverlay>
        </FadeIn>

        {/* CAC Card */}
        <FadeIn delay={0.6}>
          <UpgradeOverlay locked={!hasShopifyAnalytics} message="Upgrade to PLUS to unlock CAC tracking">
          <Card className={`border h-full shadow-sm ${marketing.cac !== null && marketing.cac < 100 ? 'border-emerald-200 bg-emerald-50/50' : marketing.cac !== null && marketing.cac <= 300 ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={`text-sm font-bold uppercase tracking-wider ${marketing.cac !== null && marketing.cac < 100 ? 'text-emerald-900' : marketing.cac !== null && marketing.cac <= 300 ? 'text-amber-900' : 'text-red-900'}`}>CAC</CardTitle>
              {marketing.cac !== null && marketing.cac < 100 ? <ArrowDownRight className="h-5 w-5 text-emerald-600" /> : <ArrowUpRight className="h-5 w-5 text-red-600" />}
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold tracking-tight ${marketing.cac !== null && marketing.cac < 100 ? 'text-emerald-950' : marketing.cac !== null && marketing.cac <= 300 ? 'text-amber-950' : 'text-red-950'}`}>
                {marketing.cac !== null ? `EGP ${Math.round(marketing.cac).toLocaleString()}` : '—'}
              </div>
              {marketing.cac !== null && marketing.cacPrevious !== null && (
                <VelocityBadge 
                  delta={marketing.cacPrevious > 0 ? ((marketing.cac - marketing.cacPrevious) / marketing.cacPrevious) * 100 : 100} 
                  invert={true}
                  subtitleText={subtitleText} 
                />
              )}
              <p className={`text-xs mt-2 font-medium ${marketing.cac !== null && marketing.cac < 100 ? 'text-emerald-700' : marketing.cac !== null && marketing.cac <= 300 ? 'text-amber-700' : 'text-red-700'}`}>
                {marketing.cac !== null ? 'Cost to acquire one new customer' : 'No ad spend logged'}
              </p>
            </CardContent>
          </Card>
          </UpgradeOverlay>
        </FadeIn>
      </div>

      {/* Products Sales */}
      {productBreakdown.length > 0 && (
        <UpgradeOverlay locked={!hasShopifyAnalytics} message="Upgrade to PLUS to unlock Product Sales insights">
          <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
            <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">Products Sales</h3>
            <div>
              {productBreakdown.map((item, idx) => (
                <div key={idx}>
                  <div className="flex flex-row justify-between text-sm font-medium text-slate-800">
                    <span>{item.name}</span>
                    <span>{item.revenue.toLocaleString("en-EG")} EGP ({item.percent}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full w-full overflow-hidden mt-2 mb-6">
                    <div className="h-full bg-[#27A67A]" style={{ width: `${item.percent}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </UpgradeOverlay>
      )}

      {/* Drop Performance Matrix */}
      <UpgradeOverlay locked={!hasAdvancedAnalytics} message="Upgrade to PRO to unlock Drop Performance analytics">
        <DropPerformanceTable data={dropPerformance} />
      </UpgradeOverlay>

      {/* Order Health Section */}
      <UpgradeOverlay locked={!hasAdvancedAnalytics} message="Upgrade to PRO to unlock Order Health & Returns analytics">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <OrderHealthFunnel data={orderFunnel} />
          <ReturnsByCity data={returnsByCity} />
        </div>
      </UpgradeOverlay>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={0.4} duration={0.5}>
          <IncomeExpenseChart data={chartData} />
        </FadeIn>
        <FadeIn delay={0.5} duration={0.5}>
          <ExpenseDonutChart data={donutData} subtitle={insights.expenseSubtitle} />
        </FadeIn>
      </div>
    </div>
  );
}

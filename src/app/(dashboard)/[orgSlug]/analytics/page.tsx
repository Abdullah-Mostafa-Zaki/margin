import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Clock, Activity } from "lucide-react";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { getDateRangeFromParams } from "@/lib/date-utils";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { ExpenseDonutChart } from "@/components/dashboard/expense-donut-chart";
import { groupTransactionsByDate } from "@/lib/chart-utils";
import { getDashboardInsights } from "@/app/actions/getDashboardInsights";
import { FadeIn } from "@/components/ui/fade-in";

export default async function AnalyticsPage(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await props.params;
  const resolvedSearchParams = await props.searchParams;

  const organization = await prisma.organization.findUnique({
    where: { slug: resolvedParams.orgSlug },
    select: { id: true }
  });
  if (!organization) redirect("/unauthorized");

  const { startDate, endDate } = getDateRangeFromParams(resolvedSearchParams);
  const dateFilter = startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {};

  // Insights is now the SINGLE SOURCE OF TRUTH for top-level KPIs
  const insights = await getDashboardInsights(organization.id, startDate, endDate);

  const dailyTransactions = await prisma.transaction.findMany({
    where: { organizationId: organization.id, status: 'RECEIVED', ...dateFilter },
    select: { date: true, type: true, amount: true },
    orderBy: { date: 'asc' }
  });
  const chartData = groupTransactionsByDate(dailyTransactions);

  const expenseByCategory = await prisma.transaction.groupBy({
    by: ['category'],
    where: { organizationId: organization.id, type: 'EXPENSE', status: 'RECEIVED', ...dateFilter },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } }
  });
  const donutData = expenseByCategory.map(e => ({
    category: e.category,
    amount: Number(e._sum.amount || 0)
  }));

  // Pareto Engine for Products Sales
  const lineItems = await prisma.lineItem.findMany({
    where: {
      transaction: {
        organizationId: organization.id,
        type: 'INCOME',
        status: 'RECEIVED',
        ...dateFilter
      }
    }
  });

  const productRevenue: Record<string, number> = {};
  let totalLineItemRevenue = 0;

  lineItems.forEach(item => {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Analytics</h1>
          <p className="text-zinc-500 md:mt-1 mt-2">Breakdown of your revenue and costs</p>
        </div>
        <div className="flex items-center gap-2">
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
            <p className={`text-sm mt-2 font-medium ${insights.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              {insights.netProfit >= 0 ? 'Your true take-home profit' : 'You are currently operating at a loss'}
            </p>
          </CardContent>
        </Card>
      </FadeIn>

      {/* 4 Card KPI Grid */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
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
              <p className="text-xs text-red-700 mt-2 font-medium">Lost COD from returned orders.</p>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      {/* Products Sales */}
      {productBreakdown.length > 0 && (
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
      )}

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

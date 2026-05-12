import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
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

  const aggregations = await prisma.transaction.groupBy({
    by: ['type'],
    where: { organizationId: organization.id, status: 'RECEIVED', ...dateFilter },
    _sum: { amount: true },
  });

  const pendingCODQuery = await prisma.transaction.aggregate({
    where: { organizationId: organization.id, type: 'INCOME', status: 'PENDING', ...dateFilter },
    _sum: { amount: true }
  });

  const totalIncome = Number(aggregations.find(a => a.type === 'INCOME')?._sum.amount || 0);
  const totalExpense = Number(aggregations.find(a => a.type === 'EXPENSE')?._sum.amount || 0);
  const totalPendingCOD = Number(pendingCODQuery._sum.amount || 0);

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
  
  const insights = await getDashboardInsights(organization.id, startDate, endDate);

  // Pareto Engine for Catalog Velocity
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

      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <FadeIn delay={0.1}>
          <Card className="border-0 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">Total Income</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-[#27A67A]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                EGP {totalIncome.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2}>
          <Card className="border-0 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">Total Expenses</CardTitle>
              <ArrowDownRight className="h-4 w-4 text-[#E06C4C]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                EGP {totalExpense.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.3}>
          {totalPendingCOD === 0 ? (
            <Card className="border-0 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Expected Inbound</CardTitle>
                <Clock className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight text-zinc-400">
                  EGP 0
                </div>
                <p className="text-xs text-zinc-500 mt-1">All cash collected.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">Expected Inbound</CardTitle>
                <Clock className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-tight text-zinc-900">
                  EGP {totalPendingCOD.toLocaleString()}
                </div>
                <p className="text-xs text-zinc-500 mt-1 font-medium">Pending cash with couriers</p>
              </CardContent>
            </Card>
          )}
        </FadeIn>
      </div>

      {/* Catalog Velocity */}
      {productBreakdown.length > 0 && (
        <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
          <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">Catalog Velocity (Top Movers)</h3>
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

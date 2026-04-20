import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Wallet, Clock } from "lucide-react";
import RealtimeListener from "@/components/dashboard/realtime-listener";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { getDateRangeFromParams } from "@/lib/date-utils";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { ExpenseDonutChart } from "@/components/dashboard/expense-donut-chart";
import { groupTransactionsByDate } from "@/lib/chart-utils";
import { getDashboardInsights } from "@/app/actions/getDashboardInsights";
import { GodMetric } from "@/components/dashboard/GodMetric";
import { Insights } from "@/components/dashboard/Insights";

export default async function DashboardPage(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const resolvedParams = await props.params;
  const resolvedSearchParams = await props.searchParams;

  const organization = await prisma.organization.findUnique({
    where: { slug: resolvedParams.orgSlug },
    select: {
      id: true,
      name: true,
      slug: true,
    }
  });

  if (!organization) {
    redirect("/unauthorized");
  }

  const { startDate, endDate } = getDateRangeFromParams(resolvedSearchParams);

  const dateFilter = startDate && endDate ? {
    date: {
      gte: startDate,
      lte: endDate,
    }
  } : {};

  // Fetch Actionable Insights Payload
  const insights = await getDashboardInsights(organization.id, startDate, endDate);

  const aggregations = await prisma.transaction.groupBy({
    by: ['type'],
    where: {
      organizationId: organization.id,
      status: 'RECEIVED',
      ...dateFilter,
    },
    _sum: {
      amount: true,
    },
  });

  const pendingCODQuery = await prisma.transaction.aggregate({
    where: {
      organizationId: organization.id,
      type: 'INCOME',
      status: 'PENDING',
      ...dateFilter,
    },
    _sum: { amount: true }
  });

  const totalIncome = Number(aggregations.find(a => a.type === 'INCOME')?._sum.amount || 0);
  const totalExpense = Number(aggregations.find(a => a.type === 'EXPENSE')?._sum.amount || 0);
  const netBalance = totalIncome - totalExpense;
  const totalPendingCOD = Number(pendingCODQuery._sum.amount || 0);

  // --- NEW CHART QUERIES ---

  const dailyTransactions = await prisma.transaction.findMany({
    where: {
      organizationId: organization.id,
      status: 'RECEIVED',
      ...dateFilter,
    },
    select: {
      date: true,
      type: true,
      amount: true,
    },
    orderBy: { date: 'asc' }
  });

  const chartData = groupTransactionsByDate(dailyTransactions);

  const expenseByCategory = await prisma.transaction.groupBy({
    by: ['category'],
    where: {
      organizationId: organization.id,
      type: 'EXPENSE',
      status: 'RECEIVED',
      ...dateFilter,
    },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } }
  });

  const donutData = expenseByCategory.map(e => ({
    category: e.category,
    amount: Number(e._sum.amount || 0)
  }));

  // -------------------------

  let activeFilterLabel = "";
  if (resolvedSearchParams.range) {
    activeFilterLabel = `Showing data for: Last ${resolvedSearchParams.range.replace('d', ' Days')}`;
  } else if (resolvedSearchParams.from && resolvedSearchParams.to) {
    activeFilterLabel = `Showing data for: ${new Date(resolvedSearchParams.from).toLocaleDateString()} - ${new Date(resolvedSearchParams.to).toLocaleDateString()}`;
  }

  return (
    <div className="space-y-6">
      <RealtimeListener orgSlug={resolvedParams.orgSlug} organizationId={organization.id} />
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{organization.name} Dashboard</h1>
          <p className="text-zinc-500">Overview of your finances</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker />
          <Link
            href={`/${resolvedParams.orgSlug}/transactions`}
            className="inline-flex h-9 w-full sm:w-auto items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 whitespace-nowrap hover:bg-zinc-50 transition-colors shadow-sm"
          >
            View Transactions
          </Link>
        </div>
      </div>

      {/* ── Emerald Hero Balance ───────────────────────────────────────── */}
      <div className="bg-[#27A67A] text-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] block relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-sm font-medium text-emerald-100 uppercase tracking-widest mb-2">Total Balance</h2>
          <div className="text-4xl md:text-5xl font-semibold tracking-tight">
            EGP {netBalance.toLocaleString()}
          </div>
        </div>
      </div>

      <Insights insights={insights} />

      {/* ── 3-Card Summary ────────────────────────────────────────────── */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <Card className="border-0">
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

        <Card className="border-0">
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

        {totalPendingCOD === 0 ? (
          <Card className="border-0">
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
          <Card className="border-0">
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
      </div>

      {/* ── God Metric (Unit Economics) ────────────────────────────────── */}
      <GodMetric insights={insights} />

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeExpenseChart data={chartData} />
        <ExpenseDonutChart data={donutData} subtitle={insights.expenseSubtitle} />
      </div>

      {activeFilterLabel && (
        <p className="text-sm text-zinc-500 font-medium">{activeFilterLabel}</p>
      )}
    </div>
  );
}
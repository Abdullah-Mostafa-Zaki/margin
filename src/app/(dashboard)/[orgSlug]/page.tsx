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

  const pendingCOD = await prisma.transaction.aggregate({
    where: {
      organizationId: organization.id,
      type: 'INCOME',
      status: 'PENDING',
    },
    _sum: { amount: true }
  });

  const totalIncome = Number(aggregations.find(a => a.type === 'INCOME')?._sum.amount || 0);
  const totalExpense = Number(aggregations.find(a => a.type === 'EXPENSE')?._sum.amount || 0);
  const netBalance = totalIncome - totalExpense;
  const totalPendingCOD = Number(pendingCOD._sum.amount || 0);

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
        <div className="flex items-center gap-3">
          <DateRangePicker />
          <Link
            href={`/${resolvedParams.orgSlug}/transactions`}
            className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900/90"
          >
            View Transactions
          </Link>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-900">Total Income</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              EGP {totalIncome.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-900">Total Expenses</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              EGP {totalExpense.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <Wallet className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-zinc-900' : 'text-red-600'}`}>
              EGP {netBalance.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-900">Expected Inbound</CardTitle>
            <Clock className="h-4 w-4 text-amber-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              EGP {totalPendingCOD.toLocaleString()}
            </div>
            <p className="text-xs text-amber-600 mt-1 font-medium">Cash with couriers</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeExpenseChart data={chartData} />
        <ExpenseDonutChart data={donutData} />
      </div>

      {activeFilterLabel && (
        <p className="text-sm text-zinc-500 font-medium">{activeFilterLabel}</p>
      )}
    </div>
  );
}
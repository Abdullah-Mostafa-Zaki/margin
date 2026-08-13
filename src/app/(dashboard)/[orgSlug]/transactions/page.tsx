import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Transaction } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { TransactionsPageClient } from "@/components/transactions/transactions-page-client";
import { X } from "lucide-react";
import RealtimeListener from "@/components/dashboard/realtime-listener";
import { getDateRangeFromParams } from "@/lib/date-utils";
import { getRecurringExpenses } from "@/app/actions/recurring.actions";

export default async function TransactionsPage(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ tag?: string; range?: string; from?: string; to?: string; page?: string; tab?: string }>;
}) {
  const resolvedParams = await props.params;
  const resolvedSearchParams = await props.searchParams;
  const tagFilter = resolvedSearchParams.tag;

  const { startDate, endDate } = getDateRangeFromParams(resolvedSearchParams);

  const dateFilter = startDate && endDate ? {
    gte: startDate,
    lte: endDate,
  } : undefined;

  const page = Number(resolvedSearchParams.page) || 1;
  const take = 50;
  const skip = (page - 1) * take;

  let activeTab: "INCOME" | "EXPENSE" | "RECURRING" = "INCOME";
  if (resolvedSearchParams.tab === "EXPENSE") activeTab = "EXPENSE";
  if (resolvedSearchParams.tab === "RECURRING") activeTab = "RECURRING";

  const organization = await prisma.organization.findFirst({ where: { deletedAt: null,  slug: resolvedParams.orgSlug },
  });

  if (!organization) {
    const headersList = await headers();
    const referer = headersList.get("referer");
    const fromPath = referer ? new URL(referer).pathname : "/";
    redirect(`/unauthorized?from=${encodeURIComponent(fromPath)}`);
  }

  const [transactions, totalTransactionsCount] = await Promise.all([
    activeTab === "RECURRING" ? Promise.resolve([]) : prisma.transaction.findMany({
      where: {
        organizationId: organization.id,
        type: activeTab,
        ...(tagFilter ? { 
          OR: [
            { dropId: tagFilter },
            { drops: { some: { dropId: tagFilter } } }
          ]
        } : {}),
        ...(dateFilter ? { date: dateFilter } : {})
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
      skip,
    }),
    activeTab === "RECURRING" ? Promise.resolve(0) : prisma.transaction.count({
      where: {
        organizationId: organization.id,
        type: activeTab,
        ...(tagFilter ? { 
          OR: [
            { dropId: tagFilter },
            { drops: { some: { dropId: tagFilter } } }
          ]
        } : {}),
        ...(dateFilter ? { date: dateFilter } : {})
      }
    })
  ]);

  const tags = await prisma.drop.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
  });

  let activeTag = null;
  if (tagFilter) {
    activeTag = tags.find((t) => t.id === tagFilter);
  }

  // Pending COD always fetched unfiltered by date
  const pendingCODAggregate = await prisma.transaction.aggregate({
    where: {
      organizationId: organization.id,
      type: "INCOME",
      status: "PENDING"
    },
    _sum: { amount: true },
    _count: true
  });
  
  const totalPendingCod = Number(pendingCODAggregate._sum.amount || 0);
  const totalPendingCodCount = pendingCODAggregate._count || 0;

  const pendingCODTransactions = await prisma.transaction.findMany({
    where: {
      organizationId: organization.id,
      type: "INCOME",
      status: "PENDING"
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 10
  });

  const recurringExpenses = await getRecurringExpenses(resolvedParams.orgSlug);

  return (
    <div className="space-y-8">
      <RealtimeListener orgSlug={resolvedParams.orgSlug} organizationId={organization.id} />

      {activeTag && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-500">Filtered by Drop:</span>
          <Badge variant="secondary" className="pl-2 pr-1 py-1 flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-900">
            {activeTag.name}
            <Link href={`/${resolvedParams.orgSlug}/transactions`} className="rounded-full hover:bg-zinc-300 p-0.5">
              <X className="h-3 w-3" />
            </Link>
          </Badge>
        </div>
      )}

      <TransactionsPageClient
        codTransactions={pendingCODTransactions.map((t: any) => ({
          ...t,
          amount: Number(t.amount)
        }))}
        totalPendingCod={totalPendingCod}
        totalPendingCodCount={totalPendingCodCount}
        showCodCard={!activeTag && totalPendingCodCount > 0}
        transactions={transactions.map((t: any) => ({
          ...t,
          amount: Number(t.amount)
        }))}
        recurringExpenses={recurringExpenses}
        orgSlug={resolvedParams.orgSlug}
        orgId={organization.id}
        tags={tags}
        activeTagLabel={activeTag?.name}
        currentPage={page}
        totalPages={activeTab === "RECURRING" ? 1 : Math.ceil(totalTransactionsCount / take)}
        activeTab={activeTab}
      />
    </div>
  );
}
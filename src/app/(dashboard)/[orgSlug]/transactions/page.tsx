import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Transaction } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkReceivedButton, MarkAllReceivedButton } from "@/components/transactions/action-buttons";
import { X } from "lucide-react";
import RealtimeListener from "@/components/dashboard/realtime-listener";
import { TransactionsShell } from "@/components/transactions/transactions-shell";
import { getDateRangeFromParams } from "@/lib/date-utils";

export default async function TransactionsPage(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ tag?: string; range?: string; from?: string; to?: string }>;
}) {
  const resolvedParams = await props.params;
  const resolvedSearchParams = await props.searchParams;
  const tagFilter = resolvedSearchParams.tag;

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const { startDate, endDate } = getDateRangeFromParams(resolvedSearchParams);

  const dateFilter = startDate && endDate ? {
    gte: startDate,
    lte: endDate,
  } : undefined;

  const organization = await prisma.organization.findUnique({
    where: { slug: resolvedParams.orgSlug },
    include: {
      transactions: {
        where: {
          ...(tagFilter ? { tags: { some: { tagId: tagFilter } } } : {}),
          ...(dateFilter ? { date: dateFilter } : {})
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!organization) redirect("/unauthorized");

  const tags = await prisma.tag.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
  });

  let activeTag = null;
  if (tagFilter) {
    activeTag = tags.find((t) => t.id === tagFilter);
  }

  // Pending COD always fetched unfiltered by date
  const pendingCODTransactions = await prisma.transaction.findMany({
    where: {
      organizationId: organization.id,
      type: "INCOME",
      status: "PENDING"
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }]
  });

  const totalPendingCod = pendingCODTransactions.reduce((sum: number, t: Transaction) => sum + Number(t.amount), 0);

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

      {!activeTag && pendingCODTransactions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-amber-900">Pending COD Escrow</CardTitle>
              <p className="text-sm text-amber-700 mt-1">
                Total pending amount: <span className="font-bold text-lg">EGP {totalPendingCod.toLocaleString()}</span>
              </p>
            </div>
            <MarkAllReceivedButton orgSlug={resolvedParams.orgSlug} />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingCODTransactions.map((t: Transaction) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm border border-amber-100">
                  <div>
                    <div className="font-medium text-amber-900">EGP {Number(t.amount).toLocaleString()}</div>
                    <div className="text-sm text-amber-600">
                      {new Date(t.date).toLocaleDateString()} • {t.notes || "No courier specified"}
                    </div>
                  </div>
                  <MarkReceivedButton id={t.id} orgSlug={resolvedParams.orgSlug} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <TransactionsShell
        transactions={organization.transactions.map((t: any) => ({
          ...t,
          amount: Number(t.amount)
        }))}
        orgSlug={resolvedParams.orgSlug}
        orgId={organization.id}
        tags={tags}
        activeTagLabel={activeTag?.name}
      />
    </div>
  );
}
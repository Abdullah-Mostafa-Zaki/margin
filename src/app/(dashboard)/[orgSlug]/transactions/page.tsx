import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Transaction } from "@prisma/client";
import TransactionForm from "@/components/transactions/transaction-form";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkReceivedButton, DeleteTransactionButton, MarkAllReceivedButton } from "@/components/transactions/action-buttons";
import { X } from "lucide-react";
import RealtimeListener from "@/components/dashboard/realtime-listener";
import { TagFilter } from "@/components/transactions/tag-filter";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
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

  // Pending COD always shows all, so we use the organization's transactions which are already filtered by Date Range!
  // Wait, if Date Range is applied, the COD list will ONLY show pending COD from that date range!
  // The Prompt says: "Pending COD card shows correct total regardless of date filter (it always shows all pending)"
  // Thus we must fetch Pending COD un-filtered by date.
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-zinc-500">Manage your income and expenses.</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <DateRangePicker />
          <TagFilter tags={tags} />
          <TransactionForm orgSlug={resolvedParams.orgSlug} tags={tags} />
        </div>
      </div>

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

      <div className="w-full">
        {/* Desktop Table (Hidden on Mobile) */}
        <div className="hidden md:block overflow-x-auto rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Date</TableHead>
                <TableHead className="whitespace-nowrap">Type</TableHead>
                <TableHead className="whitespace-nowrap">Category</TableHead>
                <TableHead className="whitespace-nowrap">Payment</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="text-right whitespace-nowrap">Amount (EGP)</TableHead>
                <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organization.transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-zinc-500">
                    {activeTag ? "No transactions found for this drop." : "No transactions found."}
                  </TableCell>
                </TableRow>
              ) : (
                organization.transactions.map((t: Transaction) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap">{new Date(t.date).toLocaleDateString()}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className={t.type === "INCOME" ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50"}>
                        {t.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{t.category}</TableCell>
                    <TableCell className="whitespace-nowrap">{t.paymentMethod}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Badge variant="outline" className={t.status === "RECEIVED" ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50"}>
                        {t.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      {Number(t.amount).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        {t.receiptUrl && (
                          <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                            Receipt
                          </a>
                        )}
                        <DeleteTransactionButton id={t.id} orgSlug={resolvedParams.orgSlug} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile List (Hidden on Desktop) */}
        <div className="md:hidden space-y-3">
          {organization.transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border border-dashed bg-zinc-50">
              <p className="text-zinc-500 font-medium">No transactions yet.</p>
            </div>
          ) : (
            organization.transactions.map((t: Transaction) => (
              <div 
                key={t.id} 
                className="flex items-center justify-between p-4 rounded-xl shadow-sm border bg-white active:scale-95 transition-transform duration-75 min-h-[44px] cursor-pointer"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900">{t.category}</span>
                    {t.receiptUrl && (
                      <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline bg-blue-50 px-1.5 py-0.5 rounded" onClick={(e) => e.stopPropagation()}>
                        Receipt
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 mt-0.5">
                    {new Date(t.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`font-medium ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'INCOME' ? '+' : '-'} {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 rounded-md border bg-zinc-50 uppercase tracking-wide">
                      {t.paymentMethod}
                    </span>
                    <div onClick={(e) => e.stopPropagation()}>
                       <DeleteTransactionButton 
                         id={t.id} 
                         orgSlug={resolvedParams.orgSlug} 
                         className="h-5 px-1.5 text-[10px] active:scale-95 transition-transform duration-75"
                       />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
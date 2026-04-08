import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DeleteTransactionButton } from "@/components/transactions/action-buttons";

export default async function TagDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; tagId: string }>;
}) {
  const { orgSlug, tagId } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const tag = await prisma.tag.findUnique({
    where: { id: tagId },
    include: {
      organization: true,
      transactions: {
        include: {
          transaction: true,
        },
      },
    },
  });

  if (!tag || tag.organization.slug !== orgSlug) {
    redirect("/unauthorized");
  }

  const transactions = tag.transactions.map((tt) => tt.transaction).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const t of transactions) {
    if (t.type === "INCOME") {
      totalIncome += Number(t.amount);
    } else if (t.type === "EXPENSE") {
      totalExpenses += Number(t.amount);
    }
  }

  const netROI = totalIncome - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/${orgSlug}/tags`}
          className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium hover:bg-zinc-100 hover:text-zinc-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tags
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tag.name}</h1>
          {tag.description && <p className="text-zinc-500">{tag.description}</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              EGP {totalIncome.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              EGP {totalExpenses.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net ROI</CardTitle>
            <Wallet className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {netROI >= 0 ? '+' : ''}EGP {netROI.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <span className="text-xs text-zinc-500">Count</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900">
              {transactions.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount (EGP)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-zinc-500">
                  No transactions linked to this tag yet.
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{new Date(t.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={t.type === "INCOME" ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50"}>
                      {t.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell>{t.paymentMethod}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={t.status === "RECEIVED" ? "text-green-600 bg-green-50" : "text-amber-600 bg-amber-50"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {Number(t.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {t.receiptUrl && (
                        <a href={t.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                          Receipt
                        </a>
                      )}
                      <DeleteTransactionButton id={t.id} orgSlug={orgSlug} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

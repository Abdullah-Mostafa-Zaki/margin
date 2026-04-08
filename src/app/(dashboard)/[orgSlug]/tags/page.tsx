import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import TagForm from "@/components/tags/tag-form";
import { DeleteTagButton } from "@/components/tags/action-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TagsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      tags: {
        include: {
          transactions: {
            include: {
              transaction: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!organization) {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Campaign Tags</h1>
          <p className="text-zinc-500">Track ROI across different product drops and marketing campaigns.</p>
        </div>
        <TagForm orgSlug={orgSlug} />
      </div>

      {organization.tags.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed bg-white text-center">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <h2 className="mt-6 text-xl font-semibold">No drops yet</h2>
            <p className="mb-8 mt-2 text-center text-sm font-normal leading-6 text-zinc-500">
              Create your first campaign tag to start tracking ROI and linked transactions.
            </p>
            <TagForm orgSlug={orgSlug} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {organization.tags.map((tag) => {
            let totalIncome = 0;
            let totalExpenses = 0;

            tag.transactions.forEach((tt) => {
              const t = tt.transaction;
              if (t.type === "INCOME") {
                totalIncome += Number(t.amount);
              } else if (t.type === "EXPENSE") {
                totalExpenses += Number(t.amount);
              }
            });

            const netROI = totalIncome - totalExpenses;

            return (
              <Card key={tag.id} className="flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{tag.name}</CardTitle>
                    {tag.description && (
                      <p className="text-sm text-zinc-500 line-clamp-2">{tag.description}</p>
                    )}
                  </div>
                  <DeleteTagButton id={tag.id} orgSlug={orgSlug} />
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                    <div className="space-y-1">
                      <p className="text-zinc-500">Income</p>
                      <p className="font-semibold text-green-600">EGP {totalIncome.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-zinc-500">Expense</p>
                      <p className="font-semibold text-red-600">EGP {totalExpenses.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  <div className="rounded-lg bg-zinc-50 p-3 flex justify-between items-center">
                    <span className="text-sm font-medium">Net ROI</span>
                    <span className={`font-bold ${netROI >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {netROI >= 0 ? '+' : ''}EGP {netROI.toLocaleString()}
                    </span>
                  </div>

                  <div className="text-sm text-zinc-500 flex justify-between items-center">
                    <span>{tag.transactions.length} transactions</span>
                  </div>

                  <div className="flex gap-2 pt-4 mt-auto">
                    <Link
                      href={`/${orgSlug}/transactions?tag=${tag.id}`}
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      View Transactions
                    </Link>
                    <Link
                      href={`/${orgSlug}/tags/${tag.id}`}
                      className="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900/90"
                    >
                      View Details
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

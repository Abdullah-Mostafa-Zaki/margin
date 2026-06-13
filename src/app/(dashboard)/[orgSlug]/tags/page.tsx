import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import TagForm from "@/components/tags/tag-form";
import { DropCard } from "@/components/tags/drop-card";

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
          <h1 className="text-2xl font-bold tracking-tight">Drops</h1>
          <p className="text-zinc-500">Track ROI across different product drops and marketing campaigns.</p>
        </div>
        <TagForm orgSlug={orgSlug} currentDropCount={organization.tags.length} />
      </div>

      {organization.tags.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed bg-white text-center">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <h2 className="mt-6 text-xl font-semibold">No drops yet</h2>
            <p className="mb-8 mt-2 text-center text-sm font-normal leading-6 text-zinc-500">
              Create your first drop to start tracking ROI.
            </p>
            <TagForm orgSlug={orgSlug} currentDropCount={organization.tags.length} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
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
            
            const dates = tag.transactions.map((tt) => tt.transaction.date);
            const startDate = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
            const endDate = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

            return (
              <DropCard
                key={tag.id}
                id={tag.id}
                orgSlug={orgSlug}
                name={tag.name}
                description={tag.description}
                startDate={startDate}
                endDate={endDate}
                totalIncome={totalIncome}
                totalExpenses={totalExpenses}
                netROI={netROI}
                transactionCount={tag.transactions.length}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

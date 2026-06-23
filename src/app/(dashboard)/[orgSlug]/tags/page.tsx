import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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
    select: {
      id: true,
      drops: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!organization) {
    const headersList = await headers();
    const referer = headersList.get("referer");
    const fromPath = referer ? new URL(referer).pathname : "/";
    redirect(`/unauthorized?from=${encodeURIComponent(fromPath)}`);
  }

  const dropsWithStats = await Promise.all(
    organization.drops.map(async (drop) => {
      const grouped = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
          organizationId: organization.id,
          OR: [
            { dropId: drop.id },
            { drops: { some: { dropId: drop.id } } }
          ]
        },
        _sum: { amount: true },
        _count: { id: true },
        _min: { date: true },
        _max: { date: true }
      });

      let totalIncome = 0;
      let totalExpenses = 0;
      let transactionCount = 0;
      let minDate: Date | null = null;
      let maxDate: Date | null = null;

      grouped.forEach((g) => {
        const amt = Number(g._sum.amount || 0);
        transactionCount += g._count.id;

        if (g.type === "INCOME") totalIncome += amt;
        else if (g.type === "EXPENSE") totalExpenses += amt;

        if (g._min.date && (!minDate || g._min.date < minDate)) minDate = g._min.date;
        if (g._max.date && (!maxDate || g._max.date > maxDate)) maxDate = g._max.date;
      });

      return {
        ...drop,
        totalIncome,
        totalExpenses,
        netROI: totalIncome - totalExpenses,
        transactionCount,
        // Prefer the explicit startDate/endDate from the Drop model;
        // fall back to the min/max transaction date for legacy drops
        startDate: drop.startDate ?? minDate,
        endDate: drop.endDate ?? maxDate,
      };
    })
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drops</h1>
          <p className="text-zinc-500">Track ROI across different product drops and marketing campaigns.</p>
        </div>
        <TagForm orgSlug={orgSlug} currentDropCount={organization.drops.length} />
      </div>

      {organization.drops.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed bg-white text-center">
          <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
            <h2 className="mt-6 text-xl font-semibold">No drops yet</h2>
            <p className="mb-8 mt-2 text-center text-sm font-normal leading-6 text-zinc-500">
              Create your first drop to start tracking ROI.
            </p>
            <TagForm orgSlug={orgSlug} currentDropCount={organization.drops.length} />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {dropsWithStats.map((drop) => (
            <DropCard
              key={drop.id}
              id={drop.id}
              orgSlug={orgSlug}
              name={drop.name}
              description={drop.description}
              startDate={drop.startDate}
              endDate={drop.endDate}
              totalIncome={drop.totalIncome}
              totalExpenses={drop.totalExpenses}
              netROI={drop.netROI}
              transactionCount={drop.transactionCount}
              status={drop.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

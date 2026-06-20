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
      tags: {
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

  const tagsWithStats = await Promise.all(
    organization.tags.map(async (tag) => {
      const grouped = await prisma.transaction.groupBy({
        by: ['type'],
        where: {
          organizationId: organization.id,
          tags: { some: { tagId: tag.id } }
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
        ...tag,
        totalIncome,
        totalExpenses,
        netROI: totalIncome - totalExpenses,
        transactionCount,
        startDate: minDate,
        endDate: maxDate,
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
          {tagsWithStats.map((tag) => (
            <DropCard
              key={tag.id}
              id={tag.id}
              orgSlug={orgSlug}
              name={tag.name}
              description={tag.description}
              startDate={tag.startDate}
              endDate={tag.endDate}
              totalIncome={tag.totalIncome}
              totalExpenses={tag.totalExpenses}
              netROI={tag.netROI}
              transactionCount={tag.transactionCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}

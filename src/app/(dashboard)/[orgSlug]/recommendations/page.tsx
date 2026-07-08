import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { GodMetric } from "@/components/dashboard/GodMetric";
import { Insights } from "@/components/dashboard/Insights";
import { getDateRangeFromParams } from "@/lib/date-utils";
import { getDashboardInsights } from "@/app/actions/getDashboardInsights";
import { PageTracker } from "@/components/analytics/PageTracker";

export default async function RecommendationsPage(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await props.params;
  const resolvedSearchParams = await props.searchParams;

  const organization = await prisma.organization.findUnique({
    where: { slug: resolvedParams.orgSlug },
    select: { id: true }
  });
  if (!organization) {
    const headersList = await headers();
    const referer = headersList.get("referer");
    const fromPath = referer ? new URL(referer).pathname : "/";
    redirect(`/unauthorized?from=${encodeURIComponent(fromPath)}`);
  }

  const { startDate, endDate } = getDateRangeFromParams(resolvedSearchParams);
  const dateFilter = startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {};

  const insights = await getDashboardInsights(organization.id, startDate, endDate);

  // Pareto Engine
  const lineItems = await prisma.lineItem.findMany({
    where: {
      transaction: {
        organizationId: organization.id,
        type: 'INCOME',
        status: 'RECEIVED',
        ...dateFilter
      }
    }
  });

  const productRevenue: Record<string, number> = {};
  let totalLineItemRevenue = 0;

  lineItems.forEach(item => {
    const rev = item.quantity * Number(item.price);
    const key = item.sku || item.name;
    productRevenue[key] = (productRevenue[key] || 0) + rev;
    totalLineItemRevenue += rev;
  });

  let productBreakdown: { name: string; revenue: number; percent: number }[] = [];

  if (totalLineItemRevenue > 0) {
    const sortedProducts = Object.entries(productRevenue).sort((a, b) => b[1] - a[1]);
    productBreakdown = sortedProducts.slice(0, 4).map(([name, rev]) => ({
      name,
      revenue: rev,
      percent: Math.round((rev / totalLineItemRevenue) * 100)
    }));
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 overflow-y-auto pb-24">
      <PageTracker feature="Recommendations" />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">War Room</h1>
        <p className="text-zinc-500 md:mt-1 mt-2">Actionable AI insights and recommendations</p>
      </div>

      <GodMetric insights={insights} />
      
      <Insights 
        insights={insights} 
        productBreakdown={productBreakdown} 
      />


    </div>
  );
}

import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
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
  if (!organization) redirect("/unauthorized");

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
    productRevenue[item.name] = (productRevenue[item.name] || 0) + rev;
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

      {/* Actionable Alerts Section */}
      <div className="mt-12 space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Actionable Alerts</h2>
        
        <div className="flex flex-col space-y-3">
          {/* Alert 1 (Warning) */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 shadow-sm">
            <span className="text-lg leading-none">⚠️</span>
            <div>
              <p className="text-sm font-medium">Missing Instapay receipts for 3 logged expenses.</p>
            </div>
          </div>

          {/* Alert 2 (Insight) */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 shadow-sm">
            <span className="text-lg leading-none">💡</span>
            <div>
              <p className="text-sm font-medium">Your Meta ad spend jumped 20% this week.</p>
            </div>
          </div>

          {/* Alert 3 (Action) */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm">
            <span className="text-lg leading-none">📦</span>
            <div>
              <p className="text-sm font-medium">5 Bosta shipments have been stuck in 'Pending' for over 48 hours.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { ChatHome } from "@/components/chat/chat-home";
import prisma from "@/lib/prisma";
import { getDashboardInsights } from "@/app/actions/getDashboardInsights";
import { getAlerts } from "@/app/actions/getAlerts";
import { getDrops } from "@/app/actions/getDrops";
import { AlertsBanner } from "@/components/dashboard/alerts-banner";
import { KpiBar } from "@/components/dashboard/kpi-bar";
import { ActiveDropsStrip } from "@/components/dashboard/active-drops-strip";

export default async function DashboardPage(props: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = await props.params;

  const org = await prisma.organization.findUnique({
    where: { slug: resolvedParams.orgSlug },
    select: {
      id: true,
      plan: true,
      currentMonthVoice: true,
      currentMonthImage: true,
      currentMonthText: true,
      drops: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!org) return null;

  const [insights, alerts, drops] = await Promise.all([
    getDashboardInsights(org.id, null, null),
    getAlerts(org.id),
    getDrops(org.id),
  ]);

  return (
    <div className="flex-1 flex flex-col h-full w-full p-4 md:p-6 overflow-y-auto">
      <div className="flex-none max-w-5xl mx-auto w-full">
        <AlertsBanner alerts={alerts} />
        <KpiBar
          netProfit={insights.netProfit}
          revenue={insights.realizedRevenue}
          pendingEscrow={insights.pendingEscrow}
          ghostRevenue={insights.ghostRevenue}
        />
        <ActiveDropsStrip drops={drops} orgSlug={resolvedParams.orgSlug} />
      </div>

      <div className="flex-1 flex flex-col w-full max-w-5xl mx-auto">
        <ChatHome
          orgSlug={resolvedParams.orgSlug}
          tags={org.drops}
          currentMonthVoice={org.currentMonthVoice ?? 0}
          currentMonthImage={org.currentMonthImage ?? 0}
          currentMonthText={org.currentMonthText ?? 0}
        />
      </div>
    </div>
  );
}
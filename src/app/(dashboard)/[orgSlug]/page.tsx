import { ChatHome } from "@/components/chat/chat-home";
import prisma from "@/lib/prisma";
import { getMonthMetrics } from "@/app/actions/getMonthMetrics";
import { getAlerts } from "@/app/actions/getAlerts";
import { AlertsBanner } from "@/components/dashboard/alerts-banner";
import { KpiBar } from "@/components/dashboard/kpi-bar";

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

  const [monthMetrics, alerts] = await Promise.all([
    getMonthMetrics(org.id),
    getAlerts(org.id),
  ]);

  return (
    <div className="flex-1 flex flex-col h-full w-full p-4 md:p-6 overflow-y-auto">
      <div className="flex-none max-w-5xl mx-auto w-full">
        <AlertsBanner alerts={alerts} />
        <KpiBar
          monthNetProfit={monthMetrics.monthNetProfit}
          monthRevenue={monthMetrics.monthRevenue}
          monthExpenses={monthMetrics.monthExpenses}
        />
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
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Clock, Activity } from "lucide-react";
import { VelocityBadge } from "@/components/dashboard/velocity-badge";
import { IncomeExpenseChart } from "@/components/dashboard/income-expense-chart";
import { ExpenseDonutChart } from "@/components/dashboard/expense-donut-chart";
import { DropPerformanceTable } from "@/components/dashboard/drop-performance-table";
import { OrderHealthFunnel } from "@/components/dashboard/order-health-funnel";
import { ReturnsByCity } from "@/components/dashboard/returns-by-city";
import { FadeIn } from "@/components/ui/fade-in";
import { UpgradeOverlay } from "@/components/ui/upgrade-overlay";
import { cn } from "@/lib/utils";

interface AnalyticsShellProps {
  insights: any;
  velocity: any;
  dropPerformance: any;
  orderFunnel: any;
  returnsByCity: any;
  marketing: any;
  chartData: any;
  donutData: any;
  productBreakdown: any;
  subtitleText: string;
  hasShopifyAnalytics: boolean;
  hasAdvancedAnalytics: boolean;
}

type TabKey = "overview" | "marketing" | "cod_returns" | "drops";

export function AnalyticsShell({
  insights,
  velocity,
  dropPerformance,
  orderFunnel,
  returnsByCity,
  marketing,
  chartData,
  donutData,
  productBreakdown,
  subtitleText,
  hasShopifyAnalytics,
  hasAdvancedAnalytics,
}: AnalyticsShellProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  return (
    <div className="space-y-6">
      {/* Segmented Control Tabs */}
      <div className="flex w-full bg-zinc-100/80 p-1 rounded-2xl gap-1 shadow-inner overflow-x-auto custom-scrollbar mb-6">
        {[
          { key: "overview", label: "Overview" },
          { key: "cod_returns", label: "Orders" },
          { key: "marketing", label: "Marketing" },
          { key: "drops", label: "Drops" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as TabKey)}
            className={cn(
              "relative flex-1 flex items-center justify-center py-2 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ease-in-out select-none whitespace-nowrap min-w-[120px]",
              activeTab === tab.key
                ? "bg-white text-[#1DB876] shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Primary Health Indicator: Net Profit */}
            <FadeIn delay={0.05}>
              <Card className={`border-2 shadow-sm ${insights.netProfit >= 0 ? 'border-emerald-500 bg-emerald-100/50' : 'border-rose-500 bg-rose-100/50'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={`text-sm md:text-base font-bold uppercase tracking-wider ${insights.netProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>
                    Net Profit
                  </CardTitle>
                  {insights.netProfit >= 0 ? <ArrowUpRight className="h-6 w-6 text-emerald-600" /> : <ArrowDownRight className="h-6 w-6 text-rose-600" />}
                </CardHeader>
                <CardContent>
                  <div className={`text-4xl md:text-5xl font-bold tracking-tight ${insights.netProfit >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
                    {insights.netProfit < 0 ? '-' : ''}EGP {Math.abs(insights.netProfit).toLocaleString()}
                  </div>
                  <VelocityBadge delta={velocity.netProfit} subtitleText={subtitleText} />
                  <p className={`text-sm mt-2 font-medium ${insights.netProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
                    {insights.netProfit >= 0 ? 'Your true take-home profit' : 'You are currently operating at a loss'}
                  </p>
                </CardContent>
              </Card>
            </FadeIn>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
              <FadeIn delay={0.1}>
                <Card className="border border-emerald-200 bg-emerald-50/50 h-full shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Realized Revenue</CardTitle>
                    <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight text-emerald-950">
                      EGP {insights.realizedRevenue.toLocaleString()}
                    </div>
                    <VelocityBadge delta={velocity.realizedRevenue} subtitleText={subtitleText} />
                    <p className="text-xs text-emerald-700 mt-2 font-medium">Actual cash received</p>
                  </CardContent>
                </Card>
              </FadeIn>

              <FadeIn delay={0.2}>
                <Card className="border border-zinc-200 bg-zinc-50 h-full shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Total Expenses</CardTitle>
                    <Activity className="h-5 w-5 text-zinc-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight text-zinc-950">
                      EGP {insights.totalExpenses.toLocaleString()}
                    </div>
                    <VelocityBadge delta={velocity.totalExpenses} invert={true} subtitleText={subtitleText} />
                    <p className="text-xs text-zinc-700 mt-2 font-medium">Manual entries & shipping costs</p>
                  </CardContent>
                </Card>
              </FadeIn>

              <FadeIn delay={0.3}>
                <Card className="border border-amber-200 bg-amber-50/50 h-full shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold text-amber-900 uppercase tracking-wider">Pending Escrow</CardTitle>
                    <Clock className="h-5 w-5 text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight text-amber-950">
                      EGP {insights.pendingEscrow.toLocaleString()}
                    </div>
                    <VelocityBadge delta={velocity.pendingEscrow} subtitleText={subtitleText} />
                    <p className="text-xs text-amber-700 mt-2 font-medium">Cash held by couriers / in transit.</p>
                  </CardContent>
                </Card>
              </FadeIn>

              <FadeIn delay={0.4}>
                <Card className="border border-red-200 bg-red-50/50 h-full shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-bold text-red-900 uppercase tracking-wider">Ghost Revenue</CardTitle>
                    <ArrowDownRight className="h-5 w-5 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight text-red-950">
                      EGP {insights.ghostRevenue.toLocaleString()}
                    </div>
                    <p className="text-xs text-red-700 mt-2 font-medium">Lost revenue from returned orders.</p>
                  </CardContent>
                </Card>
              </FadeIn>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FadeIn delay={0.5} duration={0.5}>
                <IncomeExpenseChart data={chartData} />
              </FadeIn>
              <FadeIn delay={0.6} duration={0.5}>
                <ExpenseDonutChart data={donutData} subtitle={insights.expenseSubtitle} />
              </FadeIn>
            </div>
          </div>
        )}

        {/* MARKETING TAB */}
        {activeTab === "marketing" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              {/* ROAS Card */}
              <FadeIn delay={0.1}>
                <UpgradeOverlay locked={!hasShopifyAnalytics} message="Upgrade to PLUS to unlock ROAS tracking">
                  <Card className={`border h-full shadow-sm ${marketing.roas && marketing.roas > 3 ? 'border-emerald-200 bg-emerald-50/50' : marketing.roas && marketing.roas >= 1.5 ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className={`text-sm font-bold uppercase tracking-wider ${marketing.roas && marketing.roas > 3 ? 'text-emerald-900' : marketing.roas && marketing.roas >= 1.5 ? 'text-amber-900' : 'text-red-900'}`}>ROAS</CardTitle>
                      {marketing.roas && marketing.roas > 3 ? <ArrowUpRight className="h-5 w-5 text-emerald-600" /> : <ArrowDownRight className="h-5 w-5 text-red-600" />}
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold tracking-tight ${marketing.roas && marketing.roas > 3 ? 'text-emerald-950' : marketing.roas && marketing.roas >= 1.5 ? 'text-amber-950' : 'text-red-950'}`}>
                        {marketing.roas ? `${marketing.roas.toFixed(2)}x` : '—'}
                      </div>
                      {marketing.roas !== null && marketing.roasPrevious !== null && (
                        <VelocityBadge 
                          delta={marketing.roasPrevious > 0 ? ((marketing.roas - marketing.roasPrevious) / marketing.roasPrevious) * 100 : 100} 
                          subtitleText={subtitleText} 
                        />
                      )}
                      <p className={`text-xs mt-2 font-medium ${marketing.roas && marketing.roas > 3 ? 'text-emerald-700' : marketing.roas && marketing.roas >= 1.5 ? 'text-amber-700' : 'text-red-700'}`}>
                        {marketing.roas ? 'Revenue per EGP spent on ads' : 'No ad spend logged'}
                      </p>
                    </CardContent>
                  </Card>
                </UpgradeOverlay>
              </FadeIn>

              {/* CAC Card */}
              <FadeIn delay={0.2}>
                <UpgradeOverlay locked={!hasShopifyAnalytics} message="Upgrade to PLUS to unlock CAC tracking">
                  <Card className={`border h-full shadow-sm ${marketing.cac !== null && marketing.cac < 100 ? 'border-emerald-200 bg-emerald-50/50' : marketing.cac !== null && marketing.cac <= 300 ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}`}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className={`text-sm font-bold uppercase tracking-wider ${marketing.cac !== null && marketing.cac < 100 ? 'text-emerald-900' : marketing.cac !== null && marketing.cac <= 300 ? 'text-amber-900' : 'text-red-900'}`}>CAC</CardTitle>
                      {marketing.cac !== null && marketing.cac < 100 ? <ArrowDownRight className="h-5 w-5 text-emerald-600" /> : <ArrowUpRight className="h-5 w-5 text-red-600" />}
                    </CardHeader>
                    <CardContent>
                      <div className={`text-3xl font-bold tracking-tight ${marketing.cac !== null && marketing.cac < 100 ? 'text-emerald-950' : marketing.cac !== null && marketing.cac <= 300 ? 'text-amber-950' : 'text-red-950'}`}>
                        {marketing.cac !== null ? `EGP ${Math.round(marketing.cac).toLocaleString()}` : '—'}
                      </div>
                      {marketing.cac !== null && marketing.cacPrevious !== null && (
                        <VelocityBadge 
                          delta={marketing.cacPrevious > 0 ? ((marketing.cac - marketing.cacPrevious) / marketing.cacPrevious) * 100 : 100} 
                          invert={true}
                          subtitleText={subtitleText} 
                        />
                      )}
                      <p className={`text-xs mt-2 font-medium ${marketing.cac !== null && marketing.cac < 100 ? 'text-emerald-700' : marketing.cac !== null && marketing.cac <= 300 ? 'text-amber-700' : 'text-red-700'}`}>
                        {marketing.cac !== null ? 'Cost to acquire one new customer' : 'No ad spend logged'}
                      </p>
                    </CardContent>
                  </Card>
                </UpgradeOverlay>
              </FadeIn>
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === "cod_returns" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Products Sales */}
            {productBreakdown.length > 0 && (
              <UpgradeOverlay locked={!hasShopifyAnalytics} message="Upgrade to PLUS to unlock Product Sales insights">
                <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100">
                  <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">Products Sales</h3>
                  <div>
                    {productBreakdown.map((item: any, idx: number) => (
                      <div key={idx}>
                        <div className="flex flex-row justify-between text-sm font-medium text-slate-800">
                          <span>{item.name}</span>
                          <span>{item.revenue.toLocaleString("en-EG")} EGP ({item.percent}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full w-full overflow-hidden mt-2 mb-6">
                          <div className="h-full bg-[#27A67A]" style={{ width: `${item.percent}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </UpgradeOverlay>
            )}

            <UpgradeOverlay locked={!hasAdvancedAnalytics} message="Upgrade to PRO to unlock Order Health & Returns analytics">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <OrderHealthFunnel data={orderFunnel} />
                <ReturnsByCity data={returnsByCity} />
              </div>
            </UpgradeOverlay>
          </div>
        )}

        {/* DROPS TAB */}
        {activeTab === "drops" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <UpgradeOverlay locked={!hasAdvancedAnalytics} message="Upgrade to PRO to unlock Drop Performance analytics">
              <DropPerformanceTable data={dropPerformance} />
            </UpgradeOverlay>
          </div>
        )}
      </div>
    </div>
  );
}

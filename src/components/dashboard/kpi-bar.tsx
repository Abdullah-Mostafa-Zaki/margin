import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export interface KpiBarProps {
  monthNetProfit: number;
  monthRevenue: number;
  monthExpenses: number;
}

export function KpiBar({ monthNetProfit, monthRevenue, monthExpenses }: KpiBarProps) {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
      <FadeIn delay={0.1}>
        <Card className={`rounded-md md:rounded-xl border shadow-sm transition-all duration-300 hover:shadow-md h-full ${monthNetProfit >= 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-2">
            <CardTitle className={`text-[9px] sm:text-sm lg:text-base font-bold uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis ${monthNetProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>This Month's Net Profit</CardTitle>
            {monthNetProfit >= 0 ? <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 hidden sm:block shrink-0" /> : <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 hidden sm:block shrink-0" />}
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-1 sm:pt-2">
            <div className={`text-xs sm:text-2xl lg:text-3xl font-bold tracking-tight truncate ${monthNetProfit >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
              {monthNetProfit < 0 ? '-' : ''}EGP {Math.abs(monthNetProfit).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.2}>
        <Card className="rounded-md md:rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm transition-all duration-300 hover:shadow-md h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-2">
            <CardTitle className="text-[9px] sm:text-sm lg:text-base font-bold text-emerald-900 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">This Month's Revenue</CardTitle>
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 hidden sm:block shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-1 sm:pt-2">
            <div className="text-xs sm:text-2xl lg:text-3xl font-bold tracking-tight text-emerald-950 truncate">
              EGP {monthRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.3}>
        <Card className="rounded-md md:rounded-xl border border-zinc-200 bg-zinc-50/50 shadow-sm transition-all duration-300 hover:shadow-md h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-2">
            <CardTitle className="text-[9px] sm:text-sm lg:text-base font-bold text-zinc-900 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">This Month's Expenses</CardTitle>
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-600 hidden sm:block shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-1 sm:pt-2">
            <div className="text-xs sm:text-2xl lg:text-3xl font-bold tracking-tight text-zinc-950 truncate">
              EGP {monthExpenses.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

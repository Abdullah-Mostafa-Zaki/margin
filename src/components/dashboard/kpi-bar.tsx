import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export interface KpiBarProps {
  todayNetProfit: number;
  todayRevenue: number;
  todayExpenses: number;
}

export function KpiBar({ todayNetProfit, todayRevenue, todayExpenses }: KpiBarProps) {
  return (
    <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
      <FadeIn delay={0.1}>
        <Card className={`border shadow-sm transition-all duration-300 hover:shadow-md h-full ${todayNetProfit >= 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-2">
            <CardTitle className={`text-[9px] sm:text-xs font-bold uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis ${todayNetProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>Today's Net Profit</CardTitle>
            {todayNetProfit >= 0 ? <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 hidden sm:block shrink-0" /> : <ArrowDownRight className="h-4 w-4 sm:h-5 sm:w-5 text-rose-600 hidden sm:block shrink-0" />}
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-1 sm:pt-2">
            <div className={`text-xs sm:text-lg lg:text-2xl font-bold tracking-tight truncate ${todayNetProfit >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
              {todayNetProfit < 0 ? '-' : ''}EGP {Math.abs(todayNetProfit).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.2}>
        <Card className="border border-emerald-200 bg-emerald-50/30 shadow-sm transition-all duration-300 hover:shadow-md h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-2">
            <CardTitle className="text-[9px] sm:text-xs font-bold text-emerald-900 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">Today's Revenue</CardTitle>
            <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 hidden sm:block shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-1 sm:pt-2">
            <div className="text-xs sm:text-lg lg:text-2xl font-bold tracking-tight text-emerald-950 truncate">
              EGP {todayRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.3}>
        <Card className="border border-zinc-200 bg-zinc-50/50 shadow-sm transition-all duration-300 hover:shadow-md h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 sm:p-4 pb-0 sm:pb-2">
            <CardTitle className="text-[9px] sm:text-xs font-bold text-zinc-900 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis">Today's Expenses</CardTitle>
            <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-zinc-600 hidden sm:block shrink-0" />
          </CardHeader>
          <CardContent className="p-2 sm:p-4 pt-1 sm:pt-2">
            <div className="text-xs sm:text-lg lg:text-2xl font-bold tracking-tight text-zinc-950 truncate">
              EGP {todayExpenses.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

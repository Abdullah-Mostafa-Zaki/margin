import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Clock, AlertTriangle } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";

export interface KpiBarProps {
  netProfit: number;
  revenue: number;
  pendingEscrow: number;
  ghostRevenue: number;
}

export function KpiBar({ netProfit, revenue, pendingEscrow, ghostRevenue }: KpiBarProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <FadeIn delay={0.1}>
        <Card className={`border shadow-sm transition-all duration-300 hover:shadow-md h-full ${netProfit >= 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className={`text-xs md:text-sm font-bold uppercase tracking-wider ${netProfit >= 0 ? 'text-emerald-900' : 'text-rose-900'}`}>Net Profit</CardTitle>
            {netProfit >= 0 ? <ArrowUpRight className="h-5 w-5 text-emerald-600" /> : <ArrowDownRight className="h-5 w-5 text-rose-600" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl md:text-3xl font-bold tracking-tight ${netProfit >= 0 ? 'text-emerald-950' : 'text-rose-950'}`}>
              {netProfit < 0 ? '-' : ''}EGP {Math.abs(netProfit).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.2}>
        <Card className="border border-emerald-200 bg-emerald-50/30 shadow-sm transition-all duration-300 hover:shadow-md h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-bold text-emerald-900 uppercase tracking-wider">Realized Revenue</CardTitle>
            <ArrowUpRight className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold tracking-tight text-emerald-950">
              EGP {revenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.3}>
        <Card className="border border-amber-200 bg-amber-50/30 shadow-sm transition-all duration-300 hover:shadow-md h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-bold text-amber-900 uppercase tracking-wider">Pending Escrow</CardTitle>
            <Clock className="h-5 w-5 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold tracking-tight text-amber-950">
              EGP {pendingEscrow.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.4}>
        <Card className="border border-rose-200 bg-rose-50/30 shadow-sm transition-all duration-300 hover:shadow-md h-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs md:text-sm font-bold text-rose-900 uppercase tracking-wider">Ghost Revenue</CardTitle>
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl md:text-3xl font-bold tracking-tight text-rose-950">
              EGP {ghostRevenue.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}

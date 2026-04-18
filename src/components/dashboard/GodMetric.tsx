import { DashboardInsights } from "@/app/actions/getDashboardInsights";

interface GodMetricProps {
  insights: DashboardInsights;
}

export function GodMetric({ insights }: GodMetricProps) {
  const { totalOrders, realizedRevenue, totalExpenses, netProfit } = insights;

  if (totalOrders === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
        <div className="col-span-1 md:col-span-3 rounded-xl border p-6 flex flex-col items-center justify-center text-zinc-500 bg-white shadow-sm">
          <p className="font-semibold text-lg text-zinc-700">God Metric: Profit Per Order</p>
          <p className="text-sm mt-1">Not enough order data to calculate unit economics.</p>
        </div>
      </div>
    );
  }

  const revenuePerOrder = realizedRevenue / totalOrders;
  const costPerOrder = totalExpenses / totalOrders;
  const profitPerOrder = netProfit / totalOrders;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
      {/* Revenue Per Order */}
      <div className="rounded-xl border bg-white p-5 flex flex-col justify-between shadow-sm">
        <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">AVG Revenue / Order</p>
        <p className="text-2xl font-bold text-zinc-900 truncate" title={`EGP ${revenuePerOrder}`}>
          EGP {Math.round(revenuePerOrder).toLocaleString()}
        </p>
      </div>

      {/* Cost Per Order */}
      <div className="rounded-xl border bg-white p-5 flex flex-col justify-between shadow-sm">
        <p className="text-sm font-medium text-rose-600 uppercase tracking-wider mb-2">AVG Cost / Order</p>
        <p className="text-2xl font-bold text-rose-700 truncate" title={`EGP ${costPerOrder}`}>
          EGP {Math.round(costPerOrder).toLocaleString()}
        </p>
      </div>

      {/* Profit Per Order (The God Metric) */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
        {/* Subtle accent background line */}
        <div className="absolute top-0 left-0 w-[4px] h-full bg-emerald-500"></div>
        <p className="text-sm font-bold text-emerald-800 uppercase tracking-wider mb-2 pl-2">AVG Profit / Order</p>
        <p className="text-3xl font-extrabold text-emerald-600 pl-2 truncate" title={`EGP ${profitPerOrder}`}>
          EGP {Math.round(profitPerOrder).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

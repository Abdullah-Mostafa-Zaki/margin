"use client";

import { ReturnedDrop } from "@/app/actions/getAdvancedReturnMetrics";

export function ReturnedDropsTable({ data }: { data: ReturnedDrop[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col h-full">
        <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">Most Returned Drops</h3>
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          No drops with returns for this period.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 h-full">
      <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-6">Most Returned Drops</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 border-b border-slate-100 pb-2">
          <div className="col-span-6">Drop Campaign</div>
          <div className="col-span-3 text-right">Return Rate</div>
          <div className="col-span-3 text-right">Lost Rev</div>
        </div>
        {data.map((item, idx) => {
          let color = "text-emerald-500";
          if (item.returnRate >= 15) color = "text-amber-500";
          if (item.returnRate >= 25) color = "text-rose-600";

          return (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center text-sm">
              <div className="col-span-6 font-medium text-slate-800 truncate">
                {item.dropName}
                <div className="text-[10px] text-slate-400 font-normal">{item.returnedOrders} / {item.totalOrders} orders</div>
              </div>
              <div className={`col-span-3 text-right font-bold ${color}`}>
                {item.returnRate.toFixed(1)}%
              </div>
              <div className="col-span-3 text-right text-rose-600 font-bold">
                {Math.round(item.lostRevenue).toLocaleString("en-EG")} EGP
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

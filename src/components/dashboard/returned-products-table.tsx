"use client";

import { ReturnedProduct } from "@/app/actions/getAdvancedReturnMetrics";

export function ReturnedProductsTable({ data }: { data: ReturnedProduct[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col h-full">
        <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">Most Returned Products</h3>
        <div className="flex-1 flex items-center justify-center text-sm text-slate-500">
          No product returns logged for this period.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 h-full">
      <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-6">Most Returned Products</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 border-b border-slate-100 pb-2">
          <div className="col-span-6">Product</div>
          <div className="col-span-3 text-right">Returned</div>
          <div className="col-span-3 text-right">Lost Rev</div>
        </div>
        {data.map((item, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 items-center text-sm">
            <div className="col-span-6 font-medium text-slate-800 truncate">
              {item.name}
              {item.sku && <div className="text-xs text-slate-400 font-normal">{item.sku}</div>}
            </div>
            <div className="col-span-3 text-right text-slate-600 font-medium">
              {item.quantity.toLocaleString("en-EG")}
            </div>
            <div className="col-span-3 text-right text-rose-600 font-bold">
              {Math.round(item.lostRevenue).toLocaleString("en-EG")} EGP
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

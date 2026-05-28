import { CityReturnData } from "@/app/actions/getReturnsByCity";
import { Info } from "lucide-react";

export function ReturnsByCity({ data }: { data: CityReturnData[] }) {
  if (data.length === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col h-full">
        <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">Returns by City</h3>
        <div className="text-center text-slate-500 py-12 flex-1 flex items-center justify-center">
          No city data available yet. City data is captured from new Shopify orders going forward.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col h-full">
      <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-6">Returns by City</h3>
      
      <div className="flex-1 overflow-y-auto space-y-5">
        {data.map((item, index) => {
          let barColor = "bg-green-500";
          if (item.returnRate > 20) barColor = "bg-red-500";
          else if (item.returnRate >= 10) barColor = "bg-yellow-500";

          return (
            <div key={item.city} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-sm font-medium text-slate-800">
                <span className="truncate pr-4">
                  {index + 1}. {item.city}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-500 text-xs">{item.returned.toLocaleString("en-EG")} returns</span>
                  <span className="w-12 text-right font-bold">{item.returnRate.toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full w-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(item.returnRate, 100)}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-6 text-xs sm:text-sm font-medium">
        <Info className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
        <p>Consider excluding high-return cities from Meta ad targeting to improve your COD conversion rate.</p>
      </div>
    </div>
  );
}

import { CodFunnelData } from "@/app/actions/getCodFunnel";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export function CodHealthFunnel({ data }: { data: CodFunnelData }) {
  if (data.totalOrders === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col h-full">
        <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">COD Health Funnel</h3>
        <div className="text-center text-slate-500 py-12 flex-1 flex items-center justify-center">
          No COD orders found for this period.
        </div>
      </div>
    );
  }

  // Calculate drop-offs
  const shippedDropoff = data.totalOrders > 0 ? ((data.totalOrders - data.shipped) / data.totalOrders) * 100 : 0;
  const deliveredDropoff = data.shipped > 0 ? ((data.shipped - data.delivered) / data.shipped) * 100 : 0;

  const getInsight = () => {
    if (data.returnRate > 20) {
      return (
        <div className="flex items-center gap-2 text-red-700 bg-red-50 p-3 rounded-lg border border-red-100 mt-6 text-sm font-medium">
          <AlertCircle className="h-4 w-4" />
          ⚠️ High return rate. Review product sizing and COD zones.
        </div>
      );
    }
    if (data.returnRate < 10) {
      return (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-100 mt-6 text-sm font-medium">
          <CheckCircle2 className="h-4 w-4" />
          ✅ Healthy delivery rate.
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-100 mt-6 text-sm font-medium">
        <Info className="h-4 w-4" />
        Your return rate is {data.returnRate.toFixed(1)}%. Industry average for Egyptian COD is 15–20%.
      </div>
    );
  };

  const FunnelBlock = ({ 
    label, 
    value, 
    dropoff, 
    isRed = false 
  }: { 
    label: string; 
    value: number; 
    dropoff?: number;
    isRed?: boolean;
  }) => (
    <div className="flex-1 flex flex-col items-center relative group">
      <div className={`w-full py-6 px-2 text-center text-white rounded-lg transition-transform hover:scale-105 z-10 shadow-sm relative ${isRed ? 'bg-red-500' : 'bg-green-600'}`}>
        <div className="text-2xl font-bold">{value.toLocaleString("en-EG")}</div>
        <div className="text-xs uppercase tracking-wider opacity-90 mt-1 font-medium">{label}</div>
      </div>
      {dropoff !== undefined && (
        <div className="absolute top-1/2 -right-6 lg:-right-8 -translate-y-1/2 z-0 hidden sm:flex items-center text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full border border-slate-200">
          -{dropoff.toFixed(1)}%
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col">
      <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">COD Health Funnel</h3>
      
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 lg:gap-10 items-stretch sm:items-center w-full my-auto pb-4">
        <FunnelBlock label="Total Orders" value={data.totalOrders} dropoff={shippedDropoff} />
        <div className="sm:hidden text-center text-slate-400 text-xs font-semibold py-1">-{shippedDropoff.toFixed(1)}% drop-off</div>
        
        <FunnelBlock label="Shipped" value={data.shipped} dropoff={deliveredDropoff} />
        <div className="sm:hidden text-center text-slate-400 text-xs font-semibold py-1">-{deliveredDropoff.toFixed(1)}% drop-off</div>
        
        <FunnelBlock label="Delivered" value={data.delivered} dropoff={data.returnRate} />
        <div className="sm:hidden text-center text-slate-400 text-xs font-semibold py-1">-{data.returnRate.toFixed(1)}% returned</div>
        
        <FunnelBlock label="Returned" value={data.returned} isRed={true} />
      </div>

      {getInsight()}
    </div>
  );
}

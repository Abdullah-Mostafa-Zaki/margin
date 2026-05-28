import { OrderFunnelData } from "@/app/actions/getOrderFunnel";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export function OrderHealthFunnel({ data }: { data: OrderFunnelData }) {
  if (data.totalOrders === 0) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col h-full">
        <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">Order Health Funnel</h3>
        <div className="text-center text-slate-500 py-12 flex-1 flex items-center justify-center">
          No orders found for this period.
        </div>
      </div>
    );
  }

  // Calculate percentages
  const shippedPct = data.totalOrders > 0 ? (data.shipped / data.totalOrders) * 100 : 0;
  const deliveredPct = data.shipped > 0 ? (data.delivered / data.shipped) * 100 : 0;
  const returnedPct = data.totalOrders > 0 ? (data.returned / data.totalOrders) * 100 : 0;

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

  const FunnelColumn = ({ 
    label, 
    value, 
    pctText, 
    isRed = false 
  }: { 
    label: string; 
    value: number; 
    pctText?: string;
    isRed?: boolean;
  }) => (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-full rounded-xl p-4 text-center text-white shadow-sm transition-transform hover:scale-105 ${isRed ? 'bg-red-500' : 'bg-green-600'}`}>
        <div className="text-2xl font-bold">{value.toLocaleString("en-EG")}</div>
        <div className="text-xs uppercase tracking-wider opacity-90 mt-1 font-medium">{label}</div>
      </div>
      {pctText && (
        <div className={`text-sm font-medium text-center ${isRed ? 'text-red-500' : 'text-slate-500'}`}>
          {pctText}
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 h-full flex flex-col min-w-0">
      <h3 className="uppercase tracking-[0.2em] text-[11px] font-bold text-slate-400 mb-8">Order Health Funnel</h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 w-full my-auto pb-4">
        <FunnelColumn label="Total Orders" value={data.totalOrders} />
        <FunnelColumn label="Shipped" value={data.shipped} pctText={`${shippedPct.toFixed(1)}% of total`} />
        <FunnelColumn label="Delivered" value={data.delivered} pctText={`${deliveredPct.toFixed(1)}% of shipped`} />
        <FunnelColumn label="Returned" value={data.returned} isRed={true} pctText={`${returnedPct.toFixed(1)}% of total`} />
      </div>

      {getInsight()}
    </div>
  );
}

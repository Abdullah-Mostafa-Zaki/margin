"use client";

import { DashboardInsights } from "@/app/actions/getDashboardInsights";

interface InsightsProps {
  insights: DashboardInsights;
  productBreakdown?: { name: string; revenue: number; percent: number }[];
}

export function Insights({ insights, productBreakdown = [] }: InsightsProps) {
  const profitStr = insights.netProfit.toLocaleString("en-EG");
  const marginStr = Math.round(insights.marginPct).toString();
  const rawStr = Math.round(insights.rawPercent).toString();
  const breakevenStr = insights.ordersToBreakeven.toString();
  const expectedStr = insights.pendingCOD.toLocaleString("en-EG");
  
  let marginAssessment = "";
  let assessmentColor = "";

  if (insights.marginPct >= 30) {
    marginAssessment = "Excellent";
    assessmentColor = "text-[#27A67A]";
  } else if (insights.marginPct >= 20) {
    marginAssessment = "Healthy";
    assessmentColor = "text-[#27A67A]";
  } else if (insights.marginPct >= 10) {
    marginAssessment = "Decent";
    assessmentColor = "";
  } else {
    marginAssessment = "Low";
    assessmentColor = "text-red-600";
  }

  return (
    <div className="bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)] border-l-[6px] border-[#27A67A] rounded-r-3xl rounded-l-none p-10 my-6">
      <h2 className="uppercase tracking-[0.3em] text-[11px] font-bold text-[#27A67A] mb-6">
        WHAT EXCEL IS NOT TELLING YOU
      </h2>
      
      <div className="space-y-6 text-zinc-800">
        {/* Lead Insight */}
        <p className="text-xl md:text-2xl leading-relaxed">
          Your true profit is <strong className="font-bold">{profitStr} EGP</strong>, reflecting a {marginStr}% margin. Your margins are <strong className={`font-bold ${assessmentColor}`}>{marginAssessment}</strong>.
        </p>

        {/* Elite Intelligence Bullets */}
        {(insights.rawPercent > 50 || insights.netProfit < 0 || insights.pendingCOD > 0 || (productBreakdown[0]?.percent > 60)) && (
          <div className="space-y-4 pt-4 border-t border-zinc-100">
            {productBreakdown[0]?.percent > 60 && (
              <p className="text-sm md:text-base leading-relaxed">
                <span className="font-bold">The Apex Advantage:</span> <span className="text-emerald-600">{productBreakdown[0].percent}%</span> of your revenue is driven by one product: <strong>{productBreakdown[0].name}</strong>. This is your battering ram. Kill your underperforming ads and funnel that budget directly into this SKU. Double down.
              </p>
            )}

            {insights.rawPercent > 50 && (
              <p className="text-sm md:text-base leading-relaxed">
                <span className="font-bold">Cost Warning:</span> {rawStr}% of your capital went to Raw Materials. Your production costs are eating your profit.
              </p>
            )}
            
            {insights.netProfit < 0 && (
              <p className="text-sm md:text-base leading-relaxed">
                <span className="font-bold">Breakeven Target:</span> You are currently operating at a loss. You need exactly {breakevenStr} more orders to reach profitability this month.
              </p>
            )}

            {insights.pendingCOD > 0 && (
              <p className="text-sm md:text-base leading-relaxed">
                <span className="font-bold">Pending Revenue:</span> {expectedStr} EGP is sitting in pending COD. Follow up with your courier to realize this cash.
              </p>
            )}
          </div>
        )}
      </div>

      {productBreakdown.length > 0 && (
        <>
          <hr className="my-6 border-slate-200" />
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Catalog Velocity (Top Movers)</h4>
          <div className="space-y-4">
            {productBreakdown.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm font-medium text-slate-800">
                  <span>{item.name}</span>
                  <span>{item.revenue.toLocaleString("en-EG")} EGP ({item.percent}%)</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 mb-3">
                  <div className="h-full bg-[#27A67A] rounded-full" style={{ width: `${item.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

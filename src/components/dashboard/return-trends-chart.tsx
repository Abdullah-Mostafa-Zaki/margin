"use client";

import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from "recharts";
import { formatCairoDate } from "@/lib/date-utils";
import { ReturnTrend } from "@/app/actions/getAdvancedReturnMetrics";

export function ReturnTrendsChart({ data }: { data: ReturnTrend[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-3xl border-0 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 mb-6">
        <h3 className="font-semibold tracking-tight mb-1 text-slate-800">Return Trends Over Time</h3>
        <div className="flex min-h-[300px] items-center justify-center text-sm text-slate-500">
          No return data for selected period
        </div>
      </div>
    );
  }

  // Format the date strings "YYYY-MM-DD" into more readable labels
  const formattedData = data.map(d => {
    const label = formatCairoDate(new Date(d.date), "d MMM");
    return { ...d, label };
  });

  return (
    <div className="rounded-3xl border-0 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.04)] border border-slate-100 mb-6">
      <div className="flex flex-col mb-6">
        <h3 className="font-semibold tracking-tight text-slate-800">Return Trends Over Time</h3>
        <p className="text-sm text-slate-500 mt-1">Daily count of returned orders and associated lost revenue.</p>
      </div>
      <div className="h-[300px] md:h-[400px] w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <ComposedChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} dy={10} />
            
            {/* Left Y Axis for Lost Revenue (Bar) */}
            <YAxis 
              yAxisId="left" 
              tick={{ fontSize: 12, fill: "#64748b" }} 
              tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} 
              width={50} 
              axisLine={false} 
              tickLine={false}
            />
            
            {/* Right Y Axis for Return Count (Line) */}
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              tick={{ fontSize: 12, fill: "#64748b" }} 
              width={30} 
              axisLine={false} 
              tickLine={false}
            />

            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
              formatter={(value: any, name: any) => {
                if (name === "Lost Revenue") return [`EGP ${Number(value).toLocaleString()}`, name];
                return [value, name];
              }} 
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            <Bar yAxisId="left" dataKey="lostRevenue" name="Lost Revenue" fill="#fca5a5" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Line yAxisId="right" type="monotone" dataKey="returnCount" name="Returned Orders" stroke="#e11d48" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

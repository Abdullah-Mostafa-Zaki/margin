"use client";

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend
} from "recharts";

interface Props {
  data: { category: string; amount: number }[];
  subtitle?: string;
}

const COLORS = ["#E06C4C", "#E88264", "#D95A40", "#F09C82", "#C94829", "#F5AD98", "#B53C1F"];

export function ExpenseDonutChart({ data, subtitle }: Props) {
  const total = data.reduce((acc, curr) => acc + curr.amount, 0);

  if (data.length === 0) {
    return (
      <div className="rounded-3xl border-0 bg-card p-6 flex flex-col h-full shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div>
          <h3 className="font-semibold tracking-tight">Expense Breakdown</h3>
          <p className="text-sm text-muted-foreground mb-1">By category</p>
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground min-h-[200px]">
          No expense data for selected period
        </div>
      </div>
    );
  }

  const dataWithPercentage = data.map(item => ({
    ...item,
    percentage: total > 0 ? ((item.amount / total) * 100).toFixed(0) : "0",
  }));

  const renderLegendText = (value: string, entry: any) => {
    const payload = entry.payload;
    return <span className="text-sm text-zinc-700">{value} ({payload.percentage}%)</span>;
  };

  return (
    <div className="rounded-3xl border-0 bg-card p-6 flex flex-col h-full shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div>
        <h3 className="font-semibold tracking-tight">Expense Breakdown</h3>
        <p className="text-sm text-muted-foreground mb-4">By category</p>
      </div>
      <div className="h-[300px] md:h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <PieChart>
            <Pie
              data={dataWithPercentage}
              cx="50%"
              cy="40%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="amount"
              nameKey="category"
            >
              {dataWithPercentage.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val: any) => `EGP ${Number(val).toLocaleString()}`} />
            <Legend layout="horizontal" verticalAlign="bottom" align="center" formatter={renderLegendText} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {subtitle && (
        <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-sm font-medium text-rose-600">{subtitle}</p>
        </div>
      )}
    </div>
  );
}

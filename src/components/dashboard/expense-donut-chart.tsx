"use client";

import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend
} from "recharts";

interface Props {
  data: { category: string; amount: number }[];
}

const COLORS = ["#dc2626", "#ea580c", "#d97706", "#65a30d", "#0891b2", "#7c3aed", "#db2777"];

export function ExpenseDonutChart({ data }: Props) {
  const total = data.reduce((acc, curr) => acc + curr.amount, 0);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 flex flex-col h-full">
        <div>
          <h3 className="font-semibold">Expense Breakdown</h3>
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
    <div className="rounded-xl border bg-card p-6 flex flex-col h-full">
      <div>
        <h3 className="font-semibold">Expense Breakdown</h3>
        <p className="text-sm text-muted-foreground mb-4">By category</p>
      </div>
      <div className="flex-1 min-h-[250px]">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={dataWithPercentage}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="amount"
              nameKey="category"
            >
              {dataWithPercentage.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val: any) => `EGP ${Number(val).toLocaleString()}`} />
            <Legend layout="vertical" verticalAlign="middle" align="right" formatter={renderLegendText} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

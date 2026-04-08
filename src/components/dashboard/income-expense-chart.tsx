"use client";

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from "recharts";

interface Props {
  data: { date: string; income: number; expenses: number }[];
}

export function IncomeExpenseChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <h3 className="font-semibold mb-1">Income vs Expenses</h3>
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          No data for selected period
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-6">
      <h3 className="font-semibold mb-4">Income vs Expenses</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} width={50} />
          <Tooltip formatter={(value: any) => [`EGP ${Number(value).toLocaleString()}`, '']} />
          <Legend />
          <Line type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={2} dot={false} name="Income" />
          <Line type="monotone" dataKey="expenses" stroke="#dc2626" strokeWidth={2} dot={false} name="Expenses" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from "recharts";
import { Button } from "@/components/ui/button";

interface Props {
  data: { date: string; income: number; expenses: number; adSpend: number }[];
}

export function IncomeExpenseChart({ data }: Props) {
  const [showAdSpend, setShowAdSpend] = useState(false);

  if (data.length === 0) {
    return (
      <div className="rounded-3xl border-0 bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <h3 className="font-semibold tracking-tight mb-1">Income vs Expenses</h3>
        <div className="flex min-h-[300px] md:min-h-[380px] items-center justify-center text-sm text-muted-foreground">
          No data for selected period
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-0 bg-card p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
        <h3 className="font-semibold tracking-tight">Income vs Expenses</h3>
        <Button 
          variant={showAdSpend ? "default" : "outline"} 
          size="sm" 
          onClick={() => setShowAdSpend(!showAdSpend)}
        >
          {showAdSpend ? "Hide Ad Spend Overlay" : "Show Ad Spend Overlay"}
        </Button>
      </div>
      <div className="h-[300px] md:h-[400px] w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%" minHeight={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} width={50} />
            <Tooltip formatter={(value: any) => [`EGP ${Number(value).toLocaleString()}`, '']} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#27A67A" strokeWidth={2} dot={false} name="Income" />
            <Line type="monotone" dataKey="expenses" stroke="#E06C4C" strokeWidth={2} dot={false} name="Expenses" />
            {showAdSpend && (
              <Line type="monotone" dataKey="adSpend" stroke="#6366f1" strokeWidth={2} dot={false} name="Ad Spend" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

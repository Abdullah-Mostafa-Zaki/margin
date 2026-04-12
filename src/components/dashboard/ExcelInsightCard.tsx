"use client";

import { DashboardInsights } from "@/app/actions/getDashboardInsights";
import { Lightbulb } from "lucide-react";

interface ExcelInsightCardProps {
  insights: DashboardInsights;
}

export function ExcelInsightCard({ insights }: ExcelInsightCardProps) {
  const { excelBullets } = insights;

  if (!excelBullets || excelBullets.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-blue-500" />
        <h3 className="font-semibold text-blue-900 text-lg">What Excel is NOT telling you</h3>
      </div>
      <ul className="space-y-3">
        {excelBullets.map((bullet, index) => (
          <li key={index} className="flex gap-3 text-blue-800 text-sm md:text-base leading-relaxed">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use server";

import prisma from "@/lib/prisma";
import Groq from "groq-sdk";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateAnalyticsPayload } from "@/lib/analytics";
import { ReportType } from "@prisma/client";

function getSystemPrompt(reportType: ReportType, daysCount: number): string {
  const basePrompt = `You are the fractional CFO for an Egyptian e-commerce clothing brand.
You are acting as a Fractional CFO. Analyze the provided financial payload for the exact period of ${daysCount} days.
You are NOT responsible for calculations, percentages, thresholds, trends, anomaly detection, or alert generation. These have already been computed by the system.

THE GOLDEN RULE: You MUST start every response with a "oneParagraphStory" explaining the numbers directly to the founder (e.g., "This period your business generated 52,000 EGP in revenue...").

If confidence is LOW, use a balanced educational tone and avoid strong conclusions.

Return ONLY valid raw JSON.
Do not return markdown.
Do not return explanations outside the JSON object.

Output Schema:
{
  "oneParagraphStory": "Your direct message to the founder.",
  "narrative": {
    "drivers": "Analysis of what drove revenue/profit (e.g., specific products/drops).",
    "efficiency": "Analysis of operational health (e.g., logistics, ads, fixed vs variable costs)."
  },
  "actionItems": [
    {
      "title": "Short action title",
      "priority": "HIGH | MEDIUM | LOW",
      "reason": "Why this action matters"
    }
  ]
}`;

  switch (reportType) {
    case "WEEKLY":
      return `${basePrompt}\n\nGOAL: "The Tactical Pulse" - A 30-second read on cash flow health and immediate leaks.\nNARRATIVE FOCUS: Drop ROI Performance (best vs worst tags), Return Rate Alert, Ad Efficiency, and Pending COD Warning.`;

    case "MONTHLY":
      return `${basePrompt}\n\nGOAL: "The P&L Boardroom" - A deep dive into profitability and operational efficiency.\nNARRATIVE FOCUS: Month-over-Month Comparisons, Expense Breakdown, and Fulfillment Efficiency (average delivery times from unfulfilled to delivered).`;

    case "QUARTERLY":
      return `${basePrompt}\n\nGOAL: "The Strategic Pivot" - Identifying 90-day trends for macro-level decisions.\nNARRATIVE FOCUS: Product Pareto Analysis (top 20% product concentration), Fixed vs Variable Cost Shifts (Salaries/Rent vs Ads/Logistics), and the Risk Board (dependence on a single product, margin compression).`;

    case "YEARLY":
      return `${basePrompt}\n\nGOAL: "The Tax & Bookkeeping Handoff" - A wrap-up for the Egyptian tax authority.\nNARRATIVE FOCUS: Total Year Summary, Expense Hall of Fame (where the money went), and Taxes & Legal Summary.`;

    default:
      return basePrompt;
  }
}

export async function generateReport(
  orgSlug: string,
  reportType: ReportType,
  startDateStr: string,
  endDateStr: string,
  isCron: boolean = false
) {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });

    if (!org) {
      throw new Error("Organization not found");
    }

    if (!isCron) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        throw new Error("Unauthorized");
      }
      const membership = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: session.user.id,
            organizationId: org.id,
          },
        },
      });
      if (!membership) {
        throw new Error("Forbidden: Invalid organization membership");
      }
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const daysCount = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const existingReport = await prisma.report.findUnique({
      where: {
        organizationId_type_startDate_endDate: {
          organizationId: org.id,
          type: reportType,
          startDate,
          endDate,
        },
      },
    });

    if (existingReport) {
      if (existingReport.status === "COMPLETED") {
        return { success: true, data: JSON.parse(JSON.stringify(existingReport)) };
      }
      if (existingReport.status === "GENERATING") {
        return { success: true, message: "Report generation already in progress" };
      }
      if (existingReport.status === "INSUFFICIENT_DATA") {
        return { success: true, data: JSON.parse(JSON.stringify(existingReport)) };
      }
    }

    const payload = await generateAnalyticsPayload(org.id, startDate, endDate, reportType);

    const isActivityLow = payload.metrics.revenue === 0 && payload.metrics.transactionCount < 5;

    let reportId = existingReport?.id;

    if (!reportId) {
      const newReport = await prisma.report.create({
        data: {
          organizationId: org.id,
          type: reportType,
          status: isActivityLow ? "INSUFFICIENT_DATA" : "GENERATING",
          startDate,
          endDate,
          revenue: payload.metrics.revenue,
          expenses: payload.metrics.expenses,
          profit: payload.metrics.profit,
          marginPercent: payload.metrics.marginPercent,
          metrics: payload.metrics as any,
          inputPayload: payload as any,
        },
      });
      reportId = newReport.id;
    } else {
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: isActivityLow ? "INSUFFICIENT_DATA" : "GENERATING",
          inputPayload: payload as any,
          revenue: payload.metrics.revenue,
          expenses: payload.metrics.expenses,
          profit: payload.metrics.profit,
          marginPercent: payload.metrics.marginPercent,
          metrics: payload.metrics as any,
        },
      });
    }

    if (isActivityLow) {
      return { success: true, message: "Insufficient data to generate narrative." };
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured.");
    }

    const groq = new Groq({ apiKey });
    const systemPrompt = getSystemPrompt(reportType, daysCount);

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    });

    const rawContent = completion.choices[0]?.message?.content ?? "";
    if (!rawContent) {
      throw new Error("Groq returned an empty response.");
    }

    const narrativeData = JSON.parse(rawContent);

    const completedReport = await prisma.report.update({
      where: { id: reportId },
      data: {
        status: "COMPLETED",
        oneParagraphStory: narrativeData.oneParagraphStory,
        narrative: narrativeData.narrative,
        metrics: {
          ...payload.metrics,
          actionItems: narrativeData.actionItems,
        } as any,
      },
    });

    return { success: true, data: JSON.parse(JSON.stringify(completedReport)) };

  } catch (error: any) {
    console.error(`🔴 [generateReport] Error:`, error);
    try {
      const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
      if (org) {
        const report = await prisma.report.findUnique({
          where: {
            organizationId_type_startDate_endDate: {
              organizationId: org.id,
              type: reportType,
              startDate: new Date(startDateStr),
              endDate: new Date(endDateStr),
            },
          },
        });

        if (report && report.status === "GENERATING") {
          await prisma.report.update({
            where: { id: report.id },
            data: {
              status: "FAILED",
              error: error?.message || "Unknown error occurred during generation",
            },
          });
        }
      }
    } catch (fallbackError) {
      console.error("Failed to update report status to FAILED:", fallbackError);
    }

    return { success: false, error: error?.message || "Failed to generate report" };
  }
}

export async function getTransactionsForExport(
  orgSlug: string,
  startDateStr: string,
  endDateStr: string
) {
  try {
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
    });
    if (!org) throw new Error("Organization not found");

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new Error("Unauthorized");

    const membership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: session.user.id,
          organizationId: org.id,
        },
      },
    });
    if (!membership) throw new Error("Forbidden");

    const transactions = await prisma.transaction.findMany({
      where: {
        organizationId: org.id,
        date: {
          gte: new Date(startDateStr),
          lte: new Date(endDateStr),
        },
      },
      orderBy: { date: "desc" },
    });

    const exportData = transactions.map((t) => ({
      ID: t.id,
      Date: t.date.toISOString().split("T")[0],
      Type: t.type,
      Category: t.category,
      Amount: t.amount.toString(),
      Currency: "EGP",
      Status: t.status,
      Notes: t.notes || "",
    }));

    return { success: true, data: exportData };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

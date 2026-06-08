import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateReport } from "@/actions/reports.actions";
import { sendReportEmail } from "@/lib/mail";
import { ReportType } from "@prisma/client";

export const maxDuration = 300; // Allow execution to run longer for vercel pro

function getDatesForReport(type: ReportType, now: Date) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Midnight today
  let start = new Date(end);

  switch (type) {
    case "WEEKLY":
      start.setDate(start.getDate() - 7);
      break;
    case "MONTHLY":
      start.setMonth(start.getMonth() - 1);
      break;
    case "QUARTERLY":
      start.setMonth(start.getMonth() - 3);
      break;
    case "YEARLY":
      start.setFullYear(start.getFullYear() - 1);
      break;
  }
  return { startDateStr: start.toISOString(), endDateStr: end.toISOString() };
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      select: { slug: true, id: true, name: true },
    });

    if (organizations.length === 0) {
      return NextResponse.json({ message: "No active organizations found" });
    }

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 is Sunday
    const date = now.getDate(); // 1-31
    const month = now.getMonth(); // 0-11

    const reportsToRun: ReportType[] = [];

    // Weekly: Every Sunday
    if (dayOfWeek === 0) {
      reportsToRun.push("WEEKLY");
    }

    // Monthly: 1st of the month
    if (date === 1) {
      reportsToRun.push("MONTHLY");
      
      // Quarterly: Jan 1, Apr 1, Jul 1, Oct 1
      if ([0, 3, 6, 9].includes(month)) {
        reportsToRun.push("QUARTERLY");
      }
      
      // Yearly: Jan 1
      if (month === 0) {
        reportsToRun.push("YEARLY");
      }
    }

    // If it's not a reporting day, allow forced runs via query param for testing
    const url = new URL(request.url);
    const forceType = url.searchParams.get("force");
    if (forceType && ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].includes(forceType)) {
      reportsToRun.push(forceType as ReportType);
    }

    if (reportsToRun.length === 0) {
      return NextResponse.json({ message: "No reports scheduled for today" });
    }

    const results = [];

    for (const reportType of reportsToRun) {
      const { startDateStr, endDateStr } = getDatesForReport(reportType, now);

      for (const org of organizations) {
        try {
          console.log(`[CRON] Generating ${reportType} report for ${org.name} (${org.slug})`);
          
          const result = await generateReport(org.slug, reportType, startDateStr, endDateStr, true);
          
          if (result.success && result.data?.status === "COMPLETED") {
            // Find admins and accountants
            const authorizedMembers = await prisma.membership.findMany({
              where: {
                organizationId: org.id,
                role: { in: ["ADMIN", "ACCOUNTANT"] },
              },
              include: { user: true },
            });

            const emails = authorizedMembers
              .map((m) => m.user.email)
              .filter((email): email is string => Boolean(email));

            if (emails.length > 0) {
              await sendReportEmail(emails, org.name, reportType, result.data);
            }
          }

          results.push({
            orgSlug: org.slug,
            type: reportType,
            success: result.success,
            message: result.message,
            error: result.error,
          });
        } catch (error: any) {
          console.error(`[CRON] Failed to generate ${reportType} for ${org.slug}:`, error);
          results.push({
            orgSlug: org.slug,
            type: reportType,
            success: false,
            error: error.message || "Unknown error",
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedCount: organizations.length,
      reportsRun: reportsToRun,
      results,
    });
  } catch (error: any) {
    console.error("[CRON] Fatal error in generate-reports route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

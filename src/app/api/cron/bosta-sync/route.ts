import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncBostaDeliveries } from "@/actions/bosta.actions";
import { canAccessFeature } from "@/lib/plans";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const organizations = await prisma.organization.findMany({
      where: {
        bostaIntegration: {
          isNot: null,
        },
      },
      select: { id: true, plan: true }
    });

    let totalProcessed = 0;
    let totalFailed = 0;

    for (const org of organizations) {
      if (!canAccessFeature(org.plan, 'bostaSync')) {
        continue;
      }
      const { processedCount, failedCount } = await syncBostaDeliveries(org.id);
      totalProcessed += processedCount;
      totalFailed += failedCount;
    }

    return NextResponse.json({ success: true, processedCount: totalProcessed, failedCount: totalFailed });
  } catch (error) {
    console.error("Bosta sync cron error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

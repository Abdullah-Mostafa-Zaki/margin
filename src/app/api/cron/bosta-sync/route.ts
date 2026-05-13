import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { syncBostaDeliveries } from "@/actions/bosta.actions";

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
      select: { id: true }
    });

    let totalProcessed = 0;

    for (const org of organizations) {
      const processedCount = await syncBostaDeliveries(org.id);
      totalProcessed += processedCount;
    }

    return NextResponse.json({ success: true, processedCount: totalProcessed });
  } catch (error) {
    console.error("Bosta sync cron error:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

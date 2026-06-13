import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updated = await prisma.organization.updateMany({
      data: {
        currentMonthReceipts: 0,
        currentMonthVoice: 0,
        currentMonthImage: 0,
        currentMonthText: 0,
        usageResetDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully reset usage for ${updated.count} organizations.`,
    });
  } catch (error: any) {
    console.error("[CRON] Failed to reset usage:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

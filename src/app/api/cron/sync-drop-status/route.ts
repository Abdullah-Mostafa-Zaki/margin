import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { getCairoNow } from "@/lib/date-utils";

/**
 * POST /api/cron/sync-drop-status
 *
 * Scheduled hourly via Vercel Cron. Recomputes the lifecycle status
 * (UPCOMING | LIVE | ENDED) for every Drop in the database based on
 * the current time vs. startDate / endDate.
 *
 * Protected by the CRON_SECRET environment variable. Vercel automatically
 * injects the Authorization header when triggering cron routes.
 */
export async function GET(req: Request) {
  // ── Security: verify Vercel cron secret ────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = getCairoNow();
  let updated = 0;
  let errors = 0;

  try {
    // Fetch all drops that have at least one date set
    const drops = await prisma.drop.findMany({
      where: {
        OR: [
          { startDate: { not: null } },
          { endDate: { not: null } },
        ],
      },
      select: {
        id: true,
        organizationId: true,
        startDate: true,
        endDate: true,
        status: true,
      },
    });

    // Compute the expected status for each drop
    const updates: Array<{ id: string; organizationId: string; newStatus: "UPCOMING" | "LIVE" | "ENDED" }> = [];

    for (const drop of drops) {
      let newStatus: "UPCOMING" | "LIVE" | "ENDED" = "UPCOMING";

      if (drop.endDate && now > drop.endDate) {
        newStatus = "ENDED";
      } else if (drop.startDate && now >= drop.startDate) {
        newStatus = "LIVE";
      } else {
        newStatus = "UPCOMING";
      }

      // Only queue an update if status has changed
      if (newStatus !== drop.status) {
        updates.push({ id: drop.id, organizationId: drop.organizationId, newStatus });
      }
    }

    // Apply updates in parallel batches
    if (updates.length > 0) {
      await Promise.all(
        updates.map(async ({ id, organizationId, newStatus }) => {
          try {
            await prisma.drop.update({
              where: { id },
              data: { status: newStatus },
            });

            // Bust the drops cache for this org so the homepage reflects the new status
            revalidateTag(`org-${organizationId}-drops`, 'default');
            updated++;
          } catch (err) {
            console.error(`[sync-drop-status] Failed to update drop ${id}:`, err);
            errors++;
          }
        })
      );
    }

    console.log(`[sync-drop-status] Done. ${updated} updated, ${errors} errors out of ${drops.length} total drops.`);

    return NextResponse.json({
      success: true,
      total: drops.length,
      updated,
      errors,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error("[sync-drop-status] Fatal error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

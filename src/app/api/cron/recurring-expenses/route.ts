import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendRecurringExpenseLoggedEmail } from "@/lib/mail";
import { backfillMissedOccurrences } from "@/app/actions/recurring.actions";
import { getCairoNow } from "@/lib/date-utils";

export const dynamic = 'force-dynamic';

// Vercel Cron handles the schedule. We just process whatever is due.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const now = getCairoNow();
    
    // Find all active recurring expenses where the nextDueDate is today or earlier
    const dueExpenses = await prisma.recurringExpense.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: now }
      },
      include: {
        organization: {
          include: {
            memberships: {
              where: { role: "ADMIN" },
              include: { user: true }
            }
          }
        }
      }
    });

    console.log(`[CRON] Found ${dueExpenses.length} recurring expenses due for processing.`);

    let processedCount = 0;
    let failedCount = 0;

    for (const expense of dueExpenses) {
      // The shared function handles creating all transactions starting from nextDueDate,
      // and fast-forwarding the nextDueDate exactly as needed.
      const result = await backfillMissedOccurrences(expense.id);

      if (result.processed) {
        // Send emails to owners
        const owners = expense.organization.memberships;
        for (const owner of owners) {
          if (owner.user.email) {
            try {
              await sendRecurringExpenseLoggedEmail(owner.user.email, expense.name, Number(expense.amount));
            } catch (emailErr) {
              console.error(`[CRON] Failed to send email to ${owner.user.email}:`, emailErr);
            }
          }
        }
        processedCount++;
      }
      
      if (result.failedCount) {
        failedCount += result.failedCount;
      }
    }

    return NextResponse.json({ success: true, processedCount, failedCount });
  } catch (error) {
    console.error("[CRON] Failed to process recurring expenses:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

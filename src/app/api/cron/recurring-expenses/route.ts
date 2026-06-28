import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendRecurringExpenseLoggedEmail } from "@/lib/mail";

// Vercel Cron handles the schedule. We just process whatever is due.
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const now = new Date();
    
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

    for (const expense of dueExpenses) {
      // Create the transaction
      await prisma.transaction.create({
        data: {
          organizationId: expense.organizationId,
          type: "EXPENSE",
          status: "RECEIVED",
          amount: expense.amount,
          category: expense.category,
          date: now,
          paymentMethod: "CASH", // Defaulting to CASH for automated entries, user can edit later
          notes: expense.name,
          dropId: expense.dropId,
          source: "MANUAL", // We'll leave it as MANUAL or we could add AUTOMATED if it existed
          // We must assign a createdById, we can use the first owner's ID
          createdById: expense.organization.memberships[0]?.user.id,
        }
      });

      // Calculate next due date
      const nextDate = new Date(expense.nextDueDate);
      if (expense.frequency === "WEEKLY") {
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (expense.frequency === "MONTHLY") {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (expense.frequency === "YEARLY") {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      // Ensure nextDate is in the future (if they set a start date way in the past, fast-forward it)
      while (nextDate <= now) {
        if (expense.frequency === "WEEKLY") nextDate.setDate(nextDate.getDate() + 7);
        else if (expense.frequency === "MONTHLY") nextDate.setMonth(nextDate.getMonth() + 1);
        else if (expense.frequency === "YEARLY") nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      // Update the recurring expense
      await prisma.recurringExpense.update({
        where: { id: expense.id },
        data: { nextDueDate: nextDate }
      });

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

    return NextResponse.json({ success: true, processedCount });
  } catch (error) {
    console.error("[CRON] Failed to process recurring expenses:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

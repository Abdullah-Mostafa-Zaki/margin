import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { slug } = await params;

    // Resolve organization and membership
    const org = await prisma.organization.findUnique({
      where: { slug },
      include: {
        memberships: {
          include: { user: true }
        }
      }
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user.email === process.env.SUPER_ADMIN_EMAIL;
    const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);

    if (!membership && !isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the user who is creating the records
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { transactions } = body;

    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: "No transactions provided" }, { status: 400 });
    }

    const createdTransactions = [];

    // Create transactions in the database
    // We use a loop instead of createMany to handle any complex relations or triggers if needed,
    // though createMany is also fine. Let's use a transaction block for safety.
    await prisma.$transaction(async (tx) => {
      for (const t of transactions) {
        // Enforce basic validation
        if (!t.amount || !t.type || !t.category || !t.paymentMethod) {
            continue; // Skip invalid rows or handle error
        }

        let status: "PENDING" | "RECEIVED" | "RETURNED" = "RECEIVED";
        if (t.paymentMethod === "COD") {
            status = "PENDING";
        }

        const newTx = await tx.transaction.create({
          data: {
            organizationId: org.id,
            createdById: user.id,
            type: t.type === "INCOME" ? "INCOME" : "EXPENSE",
            amount: t.amount,
            date: new Date(t.date || new Date()),
            category: t.category,
            paymentMethod: ["CASH", "CARD", "INSTAPAY", "COD"].includes(t.paymentMethod) ? t.paymentMethod : "CASH",
            status,
            notes: t.description || null,
            receiptUrl: t.imageUrl || null,
          }
        });
        createdTransactions.push(newTx);
      }
    });

    return NextResponse.json({ success: true, count: createdTransactions.length });

  } catch (error: any) {
    console.error("batch write error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

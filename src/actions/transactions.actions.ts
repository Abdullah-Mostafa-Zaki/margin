"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { posthog } from "@/lib/posthog";
import { FulfillmentStatus } from "@prisma/client";

export async function createTransaction(orgSlug: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized: No session");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden: User does not belong to this organization");

  const type = formData.get("type") as "INCOME" | "EXPENSE";
  const amountStr = formData.get("amount") as string;
  const amount = parseFloat(amountStr);
  
  if (isNaN(amount) || amount <= 0) {
    throw new Error("Validation Error: Amount must be a positive number.");
  }

  const dateStr = formData.get("date") as string;
  const category = formData.get("category") as string;
  const paymentMethod = formData.get("paymentMethod") as "CASH" | "CARD" | "INSTAPAY" | "COD";
  const statusOverride = formData.get("status") as "PENDING" | "RECEIVED" | null;
  const fulfillmentOverride = formData.get("fulfillmentStatus") as "UNFULFILLED" | "SHIPPED" | "DELIVERED" | "RETURNED" | null;
  
  const rawNotes = formData.get("notes") as string | null;
  const notes = rawNotes?.trim() ? rawNotes.trim() : null;
  
  const receiptUrl = formData.get("receiptUrl") as string | null;
  const merchantRaw = formData.get("merchant") as string | null;
  const merchant = merchantRaw?.trim() ? merchantRaw.trim() : null;
  const sourceRaw = formData.get("source") as string | null;
  const sourceEnum = ["MANUAL", "IMPORT_IMAGE", "IMPORT_CSV", "VOICE"].includes(sourceRaw || "") ? sourceRaw : "MANUAL";

  let status: any;
  if (paymentMethod === "COD" && fulfillmentOverride === "RETURNED") {
    status = "RETURNED";
  } else if (paymentMethod === "COD") {
    status = "PENDING";
  } else if (statusOverride) {
    status = statusOverride;
  } else {
    status = "RECEIVED";
  }

  const date = new Date(dateStr);
  const tagIds = formData.getAll("tagIds") as string[];

  if (tagIds.length > 0) {
    const validDrops = await prisma.drop.count({
      where: {
        id: { in: tagIds },
        organizationId: org.id,
      },
    });
    if (validDrops !== tagIds.length) {
      throw new Error("One or more drops not found in this organization");
    }
  }

  await prisma.transaction.create({
    data: {
      type,
      amount,
      date,
      category,
      paymentMethod,
      status,
      fulfillmentStatus: fulfillmentOverride || "UNFULFILLED",
      notes,
      merchant,
      receiptUrl,
      organizationId: org.id,
      createdById: membership?.userId || (session.user as any).id,
      source: sourceEnum as any,
      drops: {
        create: tagIds.map(dropId => ({ dropId })),
      },
    },
  });

  posthog.capture({
    distinctId: session.user.email,
    event: 'transaction_created',
    properties: {
      type,
      paymentMethod,
      category,
      amount
    }
  });

  revalidatePath(`/${orgSlug}/transactions`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

export async function updateTransaction(id: string, orgSlug: string, formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden");

  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.organizationId !== org.id) {
    throw new Error("Transaction not found or does not belong to this organization");
  }

  const type = formData.get("type") as "INCOME" | "EXPENSE";
  const amountStr = formData.get("amount") as string;
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    throw new Error("Validation Error: Amount must be a positive number.");
  }

  const dateStr = formData.get("date") as string;
  const category = formData.get("category") as string;
  const paymentMethod = formData.get("paymentMethod") as "CASH" | "CARD" | "INSTAPAY" | "COD";
  const statusOverride = formData.get("status") as "PENDING" | "RECEIVED" | null;
  const fulfillmentOverride = formData.get("fulfillmentStatus") as "UNFULFILLED" | "SHIPPED" | "DELIVERED" | "RETURNED" | null;
  
  const rawNotes = formData.get("notes") as string | null;
  const notes = rawNotes?.trim() ? rawNotes.trim() : null;
  
  const receiptUrl = formData.get("receiptUrl") as string | null;
  const merchantRaw = formData.get("merchant") as string | null;
  const merchant = merchantRaw?.trim() ? merchantRaw.trim() : null;

  let status: any;
  if (paymentMethod === "COD" && fulfillmentOverride === "RETURNED") {
    status = "RETURNED";
  } else if (paymentMethod === "COD") {
    status = "PENDING";
  } else if (statusOverride) {
    status = statusOverride;
  } else {
    status = "RECEIVED";
  }

  const date = new Date(dateStr);
  const tagIds = formData.getAll("tagIds") as string[];

  if (tagIds.length > 0) {
    const validDrops = await prisma.drop.count({
      where: {
        id: { in: tagIds },
        organizationId: org.id,
      },
    });
    if (validDrops !== tagIds.length) {
      throw new Error("One or more drops not found in this organization");
    }
  }

  await prisma.transaction.update({
    where: { id },
    data: {
      type,
      amount,
      date,
      category,
      paymentMethod,
      status,
      fulfillmentStatus: fulfillmentOverride || "UNFULFILLED",
      notes,
      merchant,
      receiptUrl,
    },
  });

  // Disconnect old drop assignments and connect new ones
  await prisma.transactionDrop.deleteMany({
    where: { transactionId: id },
  });

  if (tagIds.length > 0) {
    await prisma.transactionDrop.createMany({
      data: tagIds.map(dropId => ({
        transactionId: id,
        dropId,
      })),
    });
  }

  revalidatePath(`/${orgSlug}/transactions`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

export async function deleteTransaction(id: string, orgSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden");

  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.organizationId !== org.id) {
    throw new Error("Transaction not found or does not belong to this organization");
  }

  await prisma.transaction.delete({
    where: { id },
  });

  revalidatePath(`/${orgSlug}/transactions`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

export async function updateTransactionStatus(id: string, status: "PENDING" | "RECEIVED" | "RETURNED", orgSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden");

  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.organizationId !== org.id) {
    throw new Error("Transaction not found or does not belong to this organization");
  }

  await prisma.transaction.update({
    where: { id },
    data: { status },
  });

  revalidatePath(`/${orgSlug}/transactions`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

export async function markAllPendingAsReceived(orgSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden");

  await prisma.transaction.updateMany({
    where: {
      organizationId: org.id,
      type: "INCOME",
      status: "PENDING",
    },
    data: {
      status: "RECEIVED",
    },
  });

  revalidatePath(`/${orgSlug}/transactions`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

export async function bulkDeleteTransactions(ids: string[], orgSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden");

  await prisma.transaction.deleteMany({
    where: {
      id: { in: ids },
      organizationId: org.id,
    },
  });

  revalidatePath(`/${orgSlug}/transactions`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

export async function bulkUpdateStatus(ids: string[], status: "PENDING" | "RECEIVED", orgSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden");

  await prisma.transaction.updateMany({
    where: {
      id: { in: ids },
      organizationId: org.id,
    },
    data: { status },
  });

  revalidatePath(`/${orgSlug}/transactions`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

export async function bulkAssignDrop(ids: string[], dropId: string, orgSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden");

  // Verify the drop belongs to the org
  const drop = await prisma.drop.findFirst({
    where: { id: dropId, organizationId: org.id }
  });

  if (!drop) throw new Error("Drop not found or does not belong to this organization");

  // ── Double-counting prevention ────────────────────────────────────────────
  // For INCOME transactions, we update the exclusive dropId FK so that revenue
  // can only be counted toward ONE drop. EXPENSE transactions use the many-to-many
  // TransactionDrop join table (they can be shared across drops).
  const transactions = await prisma.transaction.findMany({
    where: { id: { in: ids }, organizationId: org.id },
    select: { id: true, type: true, dropId: true },
  });

  const incomeIds = transactions
    .filter((t) => t.type === "INCOME")
    .map((t) => t.id);
  const expenseIds = transactions
    .filter((t) => t.type === "EXPENSE")
    .map((t) => t.id);

  // Update INCOME transactions: exclusively link via TransactionDrop
  if (incomeIds.length > 0) {
    await prisma.transactionDrop.deleteMany({
      where: { transactionId: { in: incomeIds } }
    });
    
    await prisma.transactionDrop.createMany({
      data: incomeIds.map((id) => ({
        transactionId: id,
        dropId,
      })),
      skipDuplicates: true,
    });
  }

  // Update EXPENSE transactions: upsert into the join table (many-to-many)
  if (expenseIds.length > 0) {
    await prisma.transactionDrop.createMany({
      data: expenseIds.map((id) => ({
        transactionId: id,
        dropId,
      })),
      skipDuplicates: true,
    });
  }

  revalidatePath(`/${orgSlug}/transactions`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

export async function bulkUpdateFulfillmentStatus(ids: string[], status: FulfillmentStatus, orgSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden");

  if (status === "RETURNED") {
    await prisma.transaction.updateMany({
      where: {
        id: { in: ids },
        organizationId: org.id,
        paymentMethod: "COD"
      },
      data: { fulfillmentStatus: status, status: "RETURNED" },
    });
    await prisma.transaction.updateMany({
      where: {
        id: { in: ids },
        organizationId: org.id,
        paymentMethod: { not: "COD" }
      },
      data: { fulfillmentStatus: status },
    });
  } else {
    await prisma.transaction.updateMany({
      where: {
        id: { in: ids },
        organizationId: org.id,
      },
      data: { fulfillmentStatus: status },
    });
  }

  revalidatePath(`/${orgSlug}/transactions`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

export async function fetchTransactionsTabData({
  orgSlug,
  tab,
  tagFilter,
  startDate,
  endDate,
  page = 1,
  take = 50
}: {
  orgSlug: string;
  tab: "INCOME" | "EXPENSE" | "RECURRING";
  tagFilter?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  take?: number;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!organization) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = organization.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden");

  if (tab === "RECURRING") {
    const { getRecurringExpenses } = await import("@/app/actions/recurring.actions");
    const expenses = await getRecurringExpenses(orgSlug);
    return { transactions: [], recurringExpenses: expenses, totalCount: 0 };
  }

  const dateFilter = startDate && endDate ? {
    gte: new Date(startDate),
    lte: new Date(endDate),
  } : undefined;

  const skip = (page - 1) * take;

  const [transactions, totalCount] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        organizationId: organization.id,
        type: tab,
        ...(tagFilter ? { 
          drops: { some: { dropId: tagFilter } }
        } : {}),
        ...(dateFilter ? { date: dateFilter } : {})
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take,
      skip,
    }),
    prisma.transaction.count({
      where: {
        organizationId: organization.id,
        type: tab,
        ...(tagFilter ? { 
          drops: { some: { dropId: tagFilter } }
        } : {}),
        ...(dateFilter ? { date: dateFilter } : {})
      }
    })
  ]);

  return { 
    transactions: transactions.map((t: any) => ({
      ...t,
      amount: Number(t.amount)
    })), 
    recurringExpenses: [], 
    totalCount 
  };
}

export async function fetchPendingCODTransactions({
  orgSlug,
  skip = 0,
  take = 10
}: {
  orgSlug: string;
  skip?: number;
  take?: number;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!organization) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = organization.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) throw new Error("Forbidden: User does not belong to this organization");

  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId: organization.id,
      type: "INCOME",
      status: "PENDING"
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip,
    take
  });

  return transactions.map((t: any) => ({
    ...t,
    amount: Number(t.amount)
  }));
}

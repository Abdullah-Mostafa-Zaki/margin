"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath, updateTag } from "next/cache";
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
  const sourceRaw = formData.get("source") as string | null;
  const sourceEnum = ["MANUAL", "IMPORT_IMAGE", "IMPORT_CSV", "VOICE"].includes(sourceRaw || "") ? sourceRaw : "MANUAL";

  let status: "PENDING" | "RECEIVED";
  if (paymentMethod === "COD") {
    status = "PENDING";
  } else if (statusOverride) {
    status = statusOverride;
  } else {
    status = "RECEIVED";
  }

  const date = new Date(dateStr);
  const tagIds = formData.getAll("tagIds") as string[];

  if (tagIds.length > 0) {
    const validTags = await prisma.tag.count({
      where: {
        id: { in: tagIds },
        organizationId: org.id,
      },
    });
    if (validTags !== tagIds.length) {
      throw new Error("One or more tags not found in this organization");
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
      receiptUrl,
      organizationId: org.id,
      createdById: membership?.userId || (session.user as any).id,
      source: sourceEnum as any,
      tags: {
        create: tagIds.map(tagId => ({ tagId })),
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
  updateTag(`org-${org.id}-transactions`);
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

  let status: "PENDING" | "RECEIVED";
  if (paymentMethod === "COD") {
    status = "PENDING";
  } else if (statusOverride) {
    status = statusOverride;
  } else {
    status = "RECEIVED";
  }

  const date = new Date(dateStr);
  const tagIds = formData.getAll("tagIds") as string[];

  if (tagIds.length > 0) {
    const validTags = await prisma.tag.count({
      where: {
        id: { in: tagIds },
        organizationId: org.id,
      },
    });
    if (validTags !== tagIds.length) {
      throw new Error("One or more tags not found in this organization");
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
      receiptUrl,
    },
  });

  // Disconnect old tags and connect new ones
  await prisma.transactionTag.deleteMany({
    where: { transactionId: id },
  });

  if (tagIds.length > 0) {
    await prisma.transactionTag.createMany({
      data: tagIds.map(tagId => ({
        transactionId: id,
        tagId,
      })),
    });
  }

  revalidatePath(`/${orgSlug}/transactions`);
  updateTag(`org-${org.id}-transactions`);
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
  updateTag(`org-${org.id}-transactions`);
}

export async function updateTransactionStatus(id: string, status: "PENDING" | "RECEIVED", orgSlug: string) {
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
  updateTag(`org-${org.id}-transactions`);
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
  updateTag(`org-${org.id}-transactions`);
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
  updateTag(`org-${org.id}-transactions`);
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
  updateTag(`org-${org.id}-transactions`);
}

export async function bulkAssignDrop(ids: string[], tagId: string, orgSlug: string) {
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

  // Verify the tag belongs to the org
  const tag = await prisma.tag.findFirst({
    where: { id: tagId, organizationId: org.id }
  });
  
  if (!tag) throw new Error("Tag not found or does not belong to this organization");

  // Create assignments, skip duplicates if a transaction already has this tag
  await prisma.transactionTag.createMany({
    data: ids.map((id) => ({
      transactionId: id,
      tagId: tagId,
    })),
    skipDuplicates: true,
  });

  revalidatePath(`/${orgSlug}/transactions`);
  updateTag(`org-${org.id}-transactions`);
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

  await prisma.transaction.updateMany({
    where: {
      id: { in: ids },
      organizationId: org.id,
    },
    data: { fulfillmentStatus: status },
  });

  revalidatePath(`/${orgSlug}/transactions`);
  updateTag(`org-${org.id}-transactions`);
}

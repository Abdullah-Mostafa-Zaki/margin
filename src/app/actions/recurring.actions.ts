"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RecurringFrequency } from "@prisma/client";
import { revalidatePath } from "next/cache";

export interface RecurringExpenseData {
  name: string;
  amount: number;
  category: string;
  frequency: RecurringFrequency;
  startDate: Date;
  dropId?: string;
}

// Helper to verify user membership
async function getOrgAndVerifyUser(orgSlug: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) throw new Error("Organization not found");

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user.email === process.env.SUPER_ADMIN_EMAIL;
  const isMember = org.memberships.some((m: any) => m.user.email === session.user?.email);
  if (!isMember && !isSuperAdmin) throw new Error("Forbidden");

  return org;
}

export async function getRecurringExpenses(orgSlug: string) {
  const org = await getOrgAndVerifyUser(orgSlug);

  const expenses = await prisma.recurringExpense.findMany({
    where: { organizationId: org.id },
    include: { drop: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return expenses.map(e => ({
    ...e,
    amount: Number(e.amount)
  }));
}

export async function createRecurringExpense(orgSlug: string, data: RecurringExpenseData) {
  console.log("[createRecurringExpense] Triggered with orgSlug:", orgSlug, "data:", data);
  try {
    const org = await getOrgAndVerifyUser(orgSlug);

    const newExpense = await prisma.recurringExpense.create({
      data: {
        organizationId: org.id,
        name: data.name,
        amount: data.amount,
        category: data.category,
        frequency: data.frequency,
        startDate: data.startDate,
        nextDueDate: data.startDate, // Initial due date is the start date
        dropId: data.dropId || null,
        isActive: true,
      },
    });

    console.log("[createRecurringExpense] Success, created expense ID:", newExpense.id);
    revalidatePath(`/${orgSlug}/transactions`, "page");
    return { 
      success: true, 
      data: {
        ...newExpense,
        amount: Number(newExpense.amount)
      } 
    };
  } catch (error) {
    console.error("[createRecurringExpense] ERROR:", error);
    throw error;
  }
}

export async function updateRecurringExpense(orgSlug: string, id: string, data: Partial<RecurringExpenseData>) {
  const org = await getOrgAndVerifyUser(orgSlug);

  const existing = await prisma.recurringExpense.findFirst({
    where: { id, organizationId: org.id }
  });

  if (!existing) throw new Error("Recurring expense not found");

  let newNextDueDate = existing.nextDueDate;
  // If they change the frequency or start date, reset the next due date
  if ((data.frequency && data.frequency !== existing.frequency) || 
      (data.startDate && data.startDate.getTime() !== existing.startDate.getTime())) {
    newNextDueDate = data.startDate || existing.startDate;
  }

  const updated = await prisma.recurringExpense.update({
    where: { id },
    data: {
      name: data.name,
      amount: data.amount,
      category: data.category,
      frequency: data.frequency,
      startDate: data.startDate,
      nextDueDate: newNextDueDate,
      dropId: data.dropId === "" ? null : data.dropId, // Allow clearing drop
    },
  });

  revalidatePath(`/${orgSlug}/transactions`, "page");
  return { 
    success: true, 
    data: {
      ...updated,
      amount: Number(updated.amount)
    } 
  };
}

export async function deleteRecurringExpense(orgSlug: string, id: string) {
  const org = await getOrgAndVerifyUser(orgSlug);

  await prisma.recurringExpense.update({
    where: { id, organizationId: org.id },
    data: { isActive: false },
  });

  revalidatePath(`/${orgSlug}/transactions`, "page");
  return { success: true };
}

export async function reactivateRecurringExpense(orgSlug: string, id: string) {
  const org = await getOrgAndVerifyUser(orgSlug);

  await prisma.recurringExpense.update({
    where: { id, organizationId: org.id },
    data: { isActive: true },
  });

  revalidatePath(`/${orgSlug}/transactions`, "page");
  return { success: true };
}

export async function hardDeleteRecurringExpense(orgSlug: string, id: string) {
  const org = await getOrgAndVerifyUser(orgSlug);

  await prisma.recurringExpense.delete({
    where: { id, organizationId: org.id },
  });

  revalidatePath(`/${orgSlug}/transactions`, "page");
  return { success: true };
}

export async function bulkActivateRecurringExpenses(orgSlug: string, ids: string[]) {
  const org = await getOrgAndVerifyUser(orgSlug);

  await prisma.recurringExpense.updateMany({
    where: { id: { in: ids }, organizationId: org.id },
    data: { isActive: true },
  });

  revalidatePath(`/${orgSlug}/transactions`, "page");
  return { success: true };
}

export async function bulkDeactivateRecurringExpenses(orgSlug: string, ids: string[]) {
  const org = await getOrgAndVerifyUser(orgSlug);

  await prisma.recurringExpense.updateMany({
    where: { id: { in: ids }, organizationId: org.id },
    data: { isActive: false },
  });

  revalidatePath(`/${orgSlug}/transactions`, "page");
  return { success: true };
}

export async function bulkHardDeleteRecurringExpenses(orgSlug: string, ids: string[]) {
  const org = await getOrgAndVerifyUser(orgSlug);

  await prisma.recurringExpense.deleteMany({
    where: { id: { in: ids }, organizationId: org.id },
  });

  revalidatePath(`/${orgSlug}/transactions`, "page");
  return { success: true };
}

export async function logRecurringExpenseNow(orgSlug: string, id: string) {
  const org = await getOrgAndVerifyUser(orgSlug);
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");

  const expense = await prisma.recurringExpense.findUnique({
    where: { id, organizationId: org.id }
  });

  if (!expense) throw new Error("Recurring expense not found");

  await prisma.transaction.create({
    data: {
      organizationId: org.id,
      type: "EXPENSE",
      status: "RECEIVED",
      amount: expense.amount,
      category: expense.category,
      date: new Date(),
      paymentMethod: "CASH",
      notes: expense.name,
      dropId: expense.dropId,
      source: "MANUAL",
      createdById: user.id,
    }
  });

  revalidatePath(`/${orgSlug}/transactions`, "page");
  return { success: true };
}

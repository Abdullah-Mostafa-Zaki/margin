"use server";

import { Prisma } from '@prisma/client';
import prisma from "@/lib/prisma";
import { z } from "zod";
import { csvOrderSchema } from "@/lib/validations/csv";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function bulkImportTransactions(organizationId: string, data: unknown[]) {
  const parsed = z.array(csvOrderSchema).safeParse(data);
  
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten() };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { success: false, errors: { formErrors: ["Unauthorized"], fieldErrors: {} } };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) {
    return { success: false, errors: { formErrors: ["Organization not found"], fieldErrors: {} } };
  }

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) {
    return { success: false, errors: { formErrors: ["Forbidden"], fieldErrors: {} } };
  }
  
  const createdById = membership?.userId || (session.user as any).id;
  const incomingIds = parsed.data.map(d => d.shopifyOrderId);

  // Metrics Pre-Check
  const existingRecords = await prisma.transaction.findMany({
    where: {
      organizationId,
      shopifyOrderId: { in: incomingIds }
    },
    select: { shopifyOrderId: true }
  });

  const existingSet = new Set(existingRecords.map(r => r.shopifyOrderId as string));

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of parsed.data) {
    const { lineItems, paymentMethod, ...orderData } = order as any;

    try {
      console.log("DEBUG: Importing Order ID:", order.shopifyOrderId);
      await prisma.$transaction(async (tx) => {
        await tx.transaction.upsert({
          where: { 
            shopifyOrderId_organizationId: { 
              shopifyOrderId: order.shopifyOrderId, 
              organizationId 
            } 
          },
          update: {},
          create: {
            ...orderData,
            organizationId,
            type: "INCOME",
            category: "Shopify Sale",
            paymentMethod: paymentMethod || "COD",
            status: "RECEIVED",
            createdById,
            lineItems: { create: lineItems }
          },
        });
      });
      created++;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        skipped++;
      } else {
        failed++;
      }
    }
  }

  revalidatePath(`/${org.slug}/transactions`);

  return { success: true, created, skipped, failed };
}

import type { ParsedReceipt } from "./ai.actions";

export async function bulkSaveReceipts(organizationId: string, receipts: ParsedReceipt[]): Promise<{ success: boolean; saved: number; failed: number }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { success: false, saved: 0, failed: receipts.length };
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { memberships: { include: { user: true } } },
  });

  if (!org) {
    return { success: false, saved: 0, failed: receipts.length };
  }

  const isSuperAdmin = !!process.env.SUPER_ADMIN_EMAIL && session.user?.email === process.env.SUPER_ADMIN_EMAIL;
  const membership = org.memberships.find((m: any) => m.user.email === session.user?.email);
  if (!membership && !isSuperAdmin) {
    return { success: false, saved: 0, failed: receipts.length };
  }
  
  const createdById = membership?.userId || (session.user as any).id;

  let saved = 0;
  let failed = 0;

  for (const receipt of receipts) {
    try {
      await prisma.transaction.create({
        data: {
          organizationId,
          createdById,
          type: "EXPENSE",
          status: "RECEIVED",
          paymentMethod: "CASH",
          amount: receipt.amount ?? 0,
          date: receipt.date ? new Date(receipt.date) : new Date(),
          category: receipt.category ?? "Other",
          merchant: receipt.merchant ?? null,
          notes: receipt.notes ?? null,
          receiptUrl: receipt.imageUrl,
        }
      });
      saved++;
    } catch (err) {
      console.error("Failed to save receipt:", err);
      failed++;
    }
  }

  revalidatePath(`/${org.slug}/transactions`);

  return { success: true, saved, failed };
}

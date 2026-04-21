"use server";

import { Prisma } from '@prisma/client';
import prisma from "@/lib/prisma";
import { z } from "zod";
import { csvOrderSchema } from "@/lib/validations/csv";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function bulkImportTransactions(orgId: string, data: unknown[]) {
  const parsed = z.array(csvOrderSchema).safeParse(data);
  
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten() };
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { success: false, errors: { formErrors: ["Unauthorized"], fieldErrors: {} } };
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
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
      organizationId: orgId,
      shopifyOrderId: { in: incomingIds }
    },
    select: { shopifyOrderId: true }
  });

  const existingSet = new Set(existingRecords.map(r => r.shopifyOrderId as string));

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of parsed.data) {
    if (existingSet.has(order.shopifyOrderId)) {
      skipped++;
      continue;
    }

    const { lineItems, ...orderData } = order;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.upsert({
          where: { 
            shopifyOrderId_organizationId: { 
              shopifyOrderId: order.shopifyOrderId, 
              organizationId: orgId 
            } 
          },
          update: {},
          create: {
            ...orderData,
            organizationId: orgId,
            type: "INCOME",
            category: "Shopify Sale",
            paymentMethod: "COD",
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

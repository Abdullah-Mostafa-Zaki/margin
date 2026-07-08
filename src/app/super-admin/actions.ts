'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { Plan } from '@prisma/client';

async function verifySuperAdmin() {
  const session = await getServerSession(authOptions);

  if (!process.env.SUPER_ADMIN_EMAIL) {
    throw new Error('Super admin email not configured');
  }

  if (!session?.user?.email || session.user.email !== process.env.SUPER_ADMIN_EMAIL) {
    throw new Error('Unauthorized');
  }
}

export async function updatePlan(organizationId: string, newPlan: Plan) {
  await verifySuperAdmin();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan: newPlan },
  });

  revalidatePath('/super-admin');
}

export async function resetUsage(organizationId: string) {
  await verifySuperAdmin();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { 
      currentMonthReceipts: 0,
      currentMonthVoice: 0,
      currentMonthImage: 0,
      currentMonthText: 0,
      usageResetDate: new Date(),
    },
  });

  revalidatePath('/super-admin');
}

export async function fetchOrgActivityLog(organizationId: string) {
  await verifySuperAdmin();

  const transactions = await prisma.transaction.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return transactions;
}

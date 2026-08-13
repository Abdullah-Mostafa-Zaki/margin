'use server';

import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function checkSuperAdmin() {
  const session = await getServerSession(authOptions);
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  if (!session?.user?.email || !superAdminEmail || session.user.email !== superAdminEmail) {
    throw new Error('Unauthorized');
  }
  return session.user.email;
}

export async function softDeleteOrganization(orgId: string, orgSlug: string) {
  const actorEmail = await checkSuperAdmin();

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { deletedAt: new Date() }
    }),
    prisma.auditLog.create({
      data: {
        actorEmail,
        action: 'DELETE_ORG',
        targetType: 'ORGANIZATION',
        targetId: orgId,
        targetLabel: orgSlug,
      }
    })
  ]);

  revalidatePath('/super-admin');
}

export async function restoreOrganization(orgId: string, orgSlug: string) {
  const actorEmail = await checkSuperAdmin();

  await prisma.$transaction([
    prisma.organization.update({
      where: { id: orgId },
      data: { deletedAt: null }
    }),
    prisma.auditLog.create({
      data: {
        actorEmail,
        action: 'RESTORE_ORG',
        targetType: 'ORGANIZATION',
        targetId: orgId,
        targetLabel: orgSlug,
      }
    })
  ]);

  revalidatePath('/super-admin');
}

export async function softDeleteUser(userId: string, userEmail: string) {
  const actorEmail = await checkSuperAdmin();
  
  if (userEmail === actorEmail) {
    throw new Error('You cannot delete yourself.');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() }
    }),
    prisma.auditLog.create({
      data: {
        actorEmail,
        action: 'DELETE_USER',
        targetType: 'USER',
        targetId: userId,
        targetLabel: userEmail,
      }
    })
  ]);

  revalidatePath('/super-admin');
}

export async function restoreUser(userId: string, userEmail: string) {
  const actorEmail = await checkSuperAdmin();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null }
    }),
    prisma.auditLog.create({
      data: {
        actorEmail,
        action: 'RESTORE_USER',
        targetType: 'USER',
        targetId: userId,
        targetLabel: userEmail,
      }
    })
  ]);

  revalidatePath('/super-admin');
}

"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTag(orgSlug: string, name: string, description?: string) {
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

  await prisma.tag.create({
    data: {
      name,
      description,
      organizationId: org.id,
    },
  });

  revalidatePath(`/${orgSlug}/tags`);
}

export async function deleteTag(id: string, orgSlug: string) {
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

  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag || tag.organizationId !== org.id) {
    throw new Error("Tag not found or does not belong to this organization");
  }

  await prisma.tag.delete({
    where: { id },
  });

  revalidatePath(`/${orgSlug}/tags`);
}

export async function getTagROI(tagId: string, orgSlug: string) {
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

  const tag = await prisma.tag.findUnique({ where: { id: tagId } });
  if (!tag || tag.organizationId !== org.id) {
    throw new Error("Tag not found or does not belong to this organization");
  }

  const transactionTags = await prisma.transactionTag.findMany({
    where: { tagId },
    include: { transaction: true },
  });

  const transactions = transactionTags.map((tt: any) => tt.transaction);

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const t of transactions) {
    if (t.type === "INCOME") {
      totalIncome += Number(t.amount);
    } else if (t.type === "EXPENSE") {
      totalExpenses += Number(t.amount);
    }
  }

  return {
    totalIncome,
    totalExpenses,
    netROI: totalIncome - totalExpenses,
    transactionCount: transactions.length,
  };
}

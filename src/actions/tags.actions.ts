"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";

export async function createTag(orgSlug: string, name: string, description?: string, startDate?: string, endDate?: string) {
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

  try {
    await prisma.drop.create({
      data: {
        name,
        description,
        organizationId: org.id,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        // Compute initial status if dates are provided
        status: startDate && endDate
          ? computeDropStatus(new Date(startDate), new Date(endDate))
          : "UPCOMING",
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return { error: "A drop with this name already exists. Please choose a different name." };
    }
    throw error;
  }

  revalidatePath(`/${orgSlug}/tags`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
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

  const drop = await prisma.drop.findUnique({ where: { id } });
  if (!drop || drop.organizationId !== org.id) {
    throw new Error("Drop not found or does not belong to this organization");
  }

  await prisma.drop.delete({
    where: { id },
  });

  revalidatePath(`/${orgSlug}/tags`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
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

  const drop = await prisma.drop.findUnique({ where: { id: tagId } });
  if (!drop || drop.organizationId !== org.id) {
    throw new Error("Drop not found or does not belong to this organization");
  }

  const transactionDrops = await prisma.transactionDrop.findMany({
    where: { dropId: tagId },
    include: { transaction: true },
  });

  const transactions = transactionDrops.map((td: any) => td.transaction);

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

export async function updateTag(id: string, orgSlug: string, name: string, description?: string, startDate?: string, endDate?: string) {
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

  const duplicate = await prisma.drop.findFirst({
    where: {
      name,
      organizationId: org.id,
      NOT: { id }
    }
  });

  if (duplicate) {
    throw new Error("A drop with this name already exists. Please choose a different name.");
  }

  const parsedStart = startDate ? new Date(startDate) : undefined;
  const parsedEnd = endDate ? new Date(endDate) : undefined;

  await prisma.drop.update({
    where: { id },
    data: {
      name,
      description,
      startDate: parsedStart,
      endDate: parsedEnd,
      status: parsedStart && parsedEnd
        ? computeDropStatus(parsedStart, parsedEnd)
        : undefined,
    }
  });

  revalidatePath(`/${orgSlug}/tags`);
  revalidateTag(`org-${org.id}-transactions`, 'default');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDropStatus(startDate: Date, endDate: Date): "UPCOMING" | "LIVE" | "ENDED" {
  const now = new Date();
  if (now < startDate) return "UPCOMING";
  if (now > endDate) return "ENDED";
  return "LIVE";
}

"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateShopifySecret(
  orgSlug: string,
  secret: string
): Promise<{ success: true } | { error: string }> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return { error: "Unauthorized: No session found." };
  }

  // Resolve org from slug and include memberships for auth check
  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      memberships: {
        include: { user: true },
      },
    },
  });

  if (!org) {
    return { error: "Organization not found." };
  }

  // Verify the session user has a valid membership (ADMIN or MEMBER) in this org
  const membership = org.memberships.find(
    (m) => m.user.email === session.user?.email
  );

  if (!membership) {
    return { error: "Forbidden: You do not have access to this organization." };
  }

  if (membership.role !== "ADMIN" && membership.role !== "MEMBER") {
    return { error: "Forbidden: Insufficient permissions." };
  }

  if (!secret || secret.trim().length === 0) {
    return { error: "Secret cannot be empty." };
  }

  await prisma.organization.update({
    where: { id: org.id },
    data: { shopifyWebhookSecret: secret.trim() },
  });

  revalidatePath(`/${orgSlug}/settings`);

  return { success: true };
}

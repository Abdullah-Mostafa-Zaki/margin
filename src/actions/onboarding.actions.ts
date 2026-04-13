"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function completeOnboarding(data: {
  brandName: string;
  courierFee: number;
  startingCapital: number;
  firstDropName: string;
  shopifyWebhookUrl?: string; // <-- Added
  shopifySecretKey?: string;  // <-- Added
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");
  if (!data.brandName) throw new Error("Brand Name is required");

  // Slug generation (checking for collisions)
  const baseSlug = data.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const existingOrg = await prisma.organization.findUnique({ where: { slug: baseSlug } });
  const slug = existingOrg ? `${baseSlug}-${Math.random().toString(36).substring(2, 6)}` : baseSlug;

  // 1. Create Brand and Membership
  const newOrg = await prisma.organization.create({
    data: {
      name: data.brandName,
      slug: slug,
      courierFee: data.courierFee || 0,
      shopifyWebhookUrl: data.shopifyWebhookUrl || null, // <-- Saved to DB
      shopifySecretKey: data.shopifySecretKey || null,   // <-- Saved to DB
      memberships: {
        create: { userId: user.id, role: "ADMIN" }
      }
    }
  });

  // 2. Create First Drop (Tag) if provided
  if (data.firstDropName) {
    await prisma.tag.create({
      data: {
        name: data.firstDropName,
        organizationId: newOrg.id,
      }
    });
  }

  // 3. Inject Starting Capital if > 0
  if (data.startingCapital > 0) {
    await prisma.transaction.create({
      data: {
        amount: data.startingCapital,
        type: "INCOME",
        category: "Starting Capital",
        paymentMethod: "CASH",
        status: "RECEIVED",
        date: new Date(),
        organizationId: newOrg.id,
        createdById: user.id,
      }
    });
  }

  redirect(`/${newOrg.slug}`);
}
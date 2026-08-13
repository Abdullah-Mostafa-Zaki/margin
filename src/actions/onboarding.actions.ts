"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";


export async function completeOnboarding(data: {
  brandName: string;
  courierFee: number;
  firstDropName: string;
  firstDropStartDate: string;
  firstDropEndDate: string;
  firstDropDescription?: string;
  shopifyWebhookUrl?: string;
  shopifyWebhookSecret?: string;
  bostaEmail?: string;
  bostaPassword?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Unauthorized");

  const user = await prisma.user.findFirst({ where: { deletedAt: null,  email: session.user.email } });
  if (!user) throw new Error("User not found");
  if (!data.brandName) throw new Error("Brand Name is required");

  // Slug generation (checking for collisions)
  const baseSlug = data.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const existingOrg = await prisma.organization.findFirst({ where: { deletedAt: null,  slug: baseSlug } });
  const slug = existingOrg ? `${baseSlug}-${Math.random().toString(36).substring(2, 6)}` : baseSlug;

  // 1. Create Brand and Membership
  const isFreePeriod = new Date() < new Date('2026-11-01T00:00:00Z');
  
  const newOrg = await prisma.organization.create({
    data: {
      name: data.brandName,
      slug: slug,
      plan: isFreePeriod ? "BUSINESS" : "FREE",
      courierFee: data.courierFee || 0,
      shopifyWebhookUrl: data.shopifyWebhookUrl || null, // <-- Saved to DB
      shopifyWebhookSecret: data.shopifyWebhookSecret || null,   // <-- Saved to DB
      onboardingCompleted: true, // <-- New field
      memberships: {
        create: { userId: user.id, role: "ADMIN" }
      }
    } as any
  });

  // 2. Create First Drop (Tag) if provided
  if (data.firstDropName) {
    await prisma.drop.create({
      data: {
        name: data.firstDropName,
        organizationId: newOrg.id,
        startDate: new Date(data.firstDropStartDate),
        endDate: new Date(data.firstDropEndDate),
        description: data.firstDropDescription || null,
      }
    });
  }

  // 4. Connect Bosta if provided
  if (data.bostaEmail && data.bostaPassword) {
    const { connectBostaAccount } = await import('./bosta.actions');
    await connectBostaAccount(data.bostaEmail, data.bostaPassword, newOrg.id);
  }

  return { success: true, orgSlug: newOrg.slug, plan: newOrg.plan };
}
"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function createOrganization(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  if (!name || name.trim().length === 0) {
    throw new Error("Organization name is required");
  }

  // Generate a basic slug
  let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  if (!baseSlug) baseSlug = 'org';
  
  // Ensure uniqueness
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!user) {
    throw new Error("User not found");
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      memberships: {
        create: {
          userId: user.id,
          role: "ADMIN"
        }
      }
    }
  });

  redirect(`/${org.slug}`);
}

export async function updateOrganizationName(orgId: string, newName: string) {
  if (!newName || newName.trim() === "") throw new Error("Name is required");
  
  const updatedOrg = await prisma.organization.update({
    where: { id: orgId },
    data: { name: newName.trim() },
  });

  import("next/cache").then(mod => {
    mod.revalidatePath(`/${updatedOrg.slug}`);
    mod.revalidatePath(`/${updatedOrg.slug}/settings`);
  });
  
  return updatedOrg;
}

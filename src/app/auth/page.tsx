import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export default async function RootPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  // 1. Fetch the user directly first
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email }
  });

  if (!dbUser) {
    redirect("/login");
  }

  // 2. Fetch memberships using the clean userId
  const memberships = await prisma.membership.findMany({
    where: { userId: dbUser.id },
    include: { organization: true }
  });

  // 3. Route accordingly
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  redirect(`/${memberships[0].organization.slug}`);
}

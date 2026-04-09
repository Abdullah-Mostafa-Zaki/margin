import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Sidebar from "@/components/shared/sidebar";
import TopNav from "@/components/shared/top-nav";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  const membership = await prisma.membership.findFirst({
    where: {
      organization: { slug: resolvedParams.orgSlug },
      user: { email: session.user.email }
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        }
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        }
      }
    }
  });

  if (!membership) {
    redirect("/unauthorized");
  }

  const org = membership.organization;
  const user = membership.user;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row">
      <Sidebar
        orgSlug={org.slug}
        orgName={org.name}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <TopNav
          userName={user.name || user.email || "User"}
          userImage={user.image}
        />
        {/* pb-20 ensures content clears the fixed mobile bottom tab bar */}
        <main className="flex-1 px-4 py-6 pb-20 md:px-8 md:py-8 md:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}

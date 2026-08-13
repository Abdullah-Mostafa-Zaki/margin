export const dynamic = 'force-dynamic';

import { unstable_noStore as noStore } from 'next/cache';
import { headers } from 'next/headers';
import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Sidebar from "@/components/shared/sidebar";
import TopNav from "@/components/shared/top-nav";
import { getDashboardInsights } from "@/app/actions/getDashboardInsights";
import { PlanProvider } from "@/lib/plan-context";
import { Plan } from "@prisma/client";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  noStore();

  const resolvedParams = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  // ─── GHOST MODE CHECK ────────────────────────────────────────────────────────
  // Only the Super Admin email (set server-side via SUPER_ADMIN_EMAIL env var)
  // can bypass org membership enforcement. This value is never exposed to the client.
  const isSuperAdmin =
    !!process.env.SUPER_ADMIN_EMAIL &&
    session.user.email === process.env.SUPER_ADMIN_EMAIL;
  // ─────────────────────────────────────────────────────────────────────────────

  let org: { id: string; name: string; slug: string; plan: Plan };
  let user: { id: string; name: string | null; email: string | null; image: string | null };

  if (isSuperAdmin) {
    // Ghost Mode: fetch org directly without membership check
    const organization = await prisma.organization.findFirst({ where: { deletedAt: null,  slug: resolvedParams.orgSlug },
      select: { id: true, name: true, slug: true, plan: true },
    });

    if (!organization) {
      redirect("/");
    }

    org = organization;
    user = {
      id: "super-admin",
      name: session.user.name ?? "Super Admin",
      email: session.user.email,
      image: session.user.image ?? null,
    };
  } else {
    // Standard path: enforce membership
    const membership = await prisma.membership.findFirst({
      where: {
        organization: { slug: resolvedParams.orgSlug },
        user: { email: session.user.email },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    if (!membership) {
      const headersList = await headers();
      const referer = headersList.get("referer");
      const fromPath = referer ? new URL(referer).pathname : "/";
      redirect(`/unauthorized?from=${encodeURIComponent(fromPath)}`);
    }

    org = membership.organization;
    user = membership.user;
  }

  const insights = await getDashboardInsights(org.id, null, null);
  let mood;
  const marginPct = insights.marginPct;
  if (marginPct >= 30) {
    mood = { text: "Untouchable", emoji: "💎", color: "border-purple-300 bg-purple-100 text-purple-900" };
  } else if (marginPct >= 20) {
    mood = { text: "King", emoji: "👑", color: "border-amber-300 bg-amber-100 text-amber-900" };
  } else if (marginPct >= 10) {
    mood = { text: "Satisfied", emoji: "👌", color: "border-emerald-300 bg-emerald-100 text-emerald-900" };
  } else if (marginPct > 0) {
    mood = { text: "Unimpressed", emoji: "🥱", color: "border-slate-300 bg-slate-100 text-slate-900" };
  } else {
    mood = { text: "Disgusted", emoji: "🤢", color: "border-red-300 bg-red-100 text-red-900" };
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Ghost Mode Banner ──────────────────────────────────────────────── */}
      {isSuperAdmin && (
        <div className="w-full bg-red-600 text-white text-center py-2 text-sm font-bold tracking-widest sticky top-0 z-[100] shrink-0">
          👻 SUPER ADMIN GHOST MODE: Viewing as {org.name}
        </div>
      )}
      {/* ───────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col bg-zinc-50 md:flex-row min-w-0">
        <Sidebar
          orgSlug={org.slug}
          orgName={org.name}
        />
        <div className="flex flex-1 flex-col min-w-0">
          <TopNav
            orgSlug={org.slug}
            userName={user.name || user.email || "User"}
            userImage={user.image}
            mood={mood}
          />
          {/* pb-20 ensures content clears the fixed mobile bottom tab bar */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 md:py-8 md:pb-8">
            <PlanProvider plan={org.plan}>
              {children}
            </PlanProvider>
          </main>
        </div>
      </div>
    </div>
  );
}

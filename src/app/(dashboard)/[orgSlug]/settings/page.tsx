import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { EditOrgForm } from "@/components/settings/edit-org-form";
import { EditCourierFeeForm } from "@/components/settings/edit-courier-fee-form";
import { ShopifyIntegration } from "@/components/settings/shopify-integration";
import { BostaConnectForm } from "@/components/settings/bosta-connect-form";
import { PageTracker } from "@/components/analytics/PageTracker";
import { formatCairoDate } from "@/lib/date-utils";
import { PLAN_LIMITS } from "@/lib/plans";
import Link from "next/link";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/login");
  }

  // Security Rule: Resolve organizationId from the database using orgSlug
  const organization = await prisma.organization.findFirst({ where: { deletedAt: null,  slug: orgSlug },
    include: {
      bostaIntegration: {
        select: { id: true }
      },
      memberships: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!organization) {
    const headersList = await headers();
    const referer = headersList.get("referer");
    const fromPath = referer ? new URL(referer).pathname : "/";
    redirect(`/unauthorized?from=${encodeURIComponent(fromPath)}`);
  }

  // ── GHOST MODE: Super Admin bypass ─────────────────────────────────────────
  const isSuperAdmin =
    !!process.env.SUPER_ADMIN_EMAIL &&
    session.user?.email === process.env.SUPER_ADMIN_EMAIL;

  if (!isSuperAdmin) {
    // Security Rule: Verify current session user has a Membership record for this org
    const currentUserMembership = organization.memberships.find(
      (m) => m.user.email === session.user?.email
    );

    if (!currentUserMembership) {
      const headersList = await headers();
      const referer = headersList.get("referer");
      const fromPath = referer ? new URL(referer).pathname : "/";
      redirect(`/unauthorized?from=${encodeURIComponent(fromPath)}`);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────────

  // Derive a boolean — never send the raw secret to the client
  const hasSecret = Boolean(organization.shopifyWebhookSecret);

  const limits = PLAN_LIMITS[organization.plan as keyof typeof PLAN_LIMITS];
  const isShopifyLocked = !limits.shopifySync;
  const isBostaLocked = !limits.bostaSync;
  const isTeamFull = organization.memberships.length >= limits.maxTeamMembers;

  // Base URL for constructing the webhook endpoint
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  return (
    <div className="space-y-6 max-w-[100vw] mx-auto p-4 md:p-8 w-full overflow-x-hidden">
      <PageTracker feature="Settings" />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brand Settings</h1>
        <p className="text-zinc-500">Manage your brand and team members.</p>
      </div>

      <div className="grid gap-6">
        {/* Brand Details */}
        <div className="rounded-lg border bg-white p-6 shadow-sm w-full max-w-full overflow-hidden">
          <h2 className="mb-4 text-lg font-medium">General Information</h2>
          <div className="space-y-4 w-full max-w-full">
            <EditOrgForm organization={{ id: organization.id, name: organization.name }} />
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand URL Slug</label>
              <input
                disabled
                value={organization.slug}
                className="flex h-10 w-full min-w-0 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
              />
            </div>
            <p className="text-xs text-zinc-500">Contact support to change these details.</p>
            <hr className="my-2" />
            <EditCourierFeeForm orgId={organization.id} initialFee={organization.courierFee || 0} />
          </div>
        </div>

        {/* Shopify Integration */}
        <ShopifyIntegration
          orgSlug={orgSlug}
          baseUrl={baseUrl}
          hasSecret={hasSecret}
          isLocked={isShopifyLocked}
        />

        {/* Bosta Integration */}
        <div className="rounded-lg border bg-white p-6 shadow-sm w-full max-w-full overflow-hidden">
          <BostaConnectForm orgId={organization.id} isConnectedInitially={!!organization.bostaIntegration} isLocked={isBostaLocked} />
        </div>

        {/* Team Members */}
        <div className="rounded-lg border bg-white p-6 shadow-sm w-full max-w-full overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-medium">Team Members</h2>
              <p className="text-xs text-zinc-500 mt-1">
                {organization.memberships.length} of {limits.maxTeamMembers} seats used
              </p>
            </div>
            <div className="hidden">
              {isTeamFull ? (
                <div className="text-right">
                  <button disabled className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400 cursor-not-allowed">
                    Invite Member
                  </button>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Team limit reached. <Link href={`/${orgSlug}/pricing`} className="text-emerald-600 hover:underline">Upgrade</Link> to add more.
                  </p>
                </div>
              ) : (
                <button className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900/90">
                  Invite Member
                </button>
              )}
            </div>
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block w-full overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">User</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 whitespace-nowrap">Role</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-right whitespace-nowrap">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {organization.memberships.map((membership) => (
                  <tr key={membership.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden shrink-0">
                          {membership.user.image ? (
                            <img src={membership.user.image} alt={membership.user.name || "Avatar"} />
                          ) : (
                            <span className="text-xs font-medium text-zinc-600">
                              {(membership.user.name || membership.user.email || "U").substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-zinc-900 truncate capitalize">
                            {membership.user.name || membership.user.email?.split('@')[0] || "Unknown User"}
                          </span>
                          <span className="text-xs text-zinc-500 truncate">{membership.user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                        {membership.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500 whitespace-nowrap">
                      {formatCairoDate(new Date(membership.createdAt), "MM/dd/yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="sm:hidden flex flex-col gap-3 mt-4">
            {organization.memberships.map((membership) => (
              <div key={membership.id} className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-200">
                      {membership.user.image ? (
                        <img src={membership.user.image} alt={membership.user.name || "Avatar"} />
                      ) : (
                        <span className="text-sm font-medium text-zinc-600">
                          {(membership.user.name || membership.user.email || "U").substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-zinc-900 truncate capitalize">
                        {membership.user.name || membership.user.email?.split('@')[0] || "Unknown User"}
                      </span>
                      <span className="text-xs text-zinc-500 truncate">{membership.user.email}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full border bg-zinc-50 px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-bold shrink-0">
                    {membership.role}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider border-t pt-2 mt-1">
                  Joined {formatCairoDate(new Date(membership.createdAt), "MM/dd/yyyy")}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

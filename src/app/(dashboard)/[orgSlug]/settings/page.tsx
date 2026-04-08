import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { EditOrgForm } from "@/components/settings/edit-org-form";

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
  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    include: {
      memberships: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!organization) {
    redirect("/unauthorized");
  }

  // Security Rule: Verify current session user has a Membership record for this org
  const currentUserMembership = organization.memberships.find(
    (m) => m.user.email === session.user?.email
  );

  if (!currentUserMembership) {
    redirect("/unauthorized");
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Brand Settings</h1>
        <p className="text-zinc-500">Manage your brand and team members.</p>
      </div>

      <div className="grid gap-6">
        {/* Brand Details */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-medium">General Information</h2>
          <div className="space-y-4 max-w-md">
            <EditOrgForm organization={{ id: organization.id, name: organization.name }} />
            <div className="space-y-2">
              <label className="text-sm font-medium">Brand URL Slug</label>
              <input
                disabled
                value={organization.slug}
                className="flex h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500"
              />
            </div>
            <p className="text-xs text-zinc-500">Contact support to change these details.</p>
          </div>
        </div>

        {/* Team Members */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Team Members</h2>
            <button className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900/90">
              Invite Member
            </button>
          </div>
          
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50">
                <tr className="border-b text-left">
                  <th className="px-4 py-3 font-medium text-zinc-500">User</th>
                  <th className="px-4 py-3 font-medium text-zinc-500">Role</th>
                  <th className="px-4 py-3 font-medium text-zinc-500 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {organization.memberships.map((membership) => (
                  <tr key={membership.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden">
                          {membership.user.image ? (
                            <img src={membership.user.image} alt={membership.user.name || "Avatar"} />
                          ) : (
                            <span className="text-xs font-medium text-zinc-600">
                              {(membership.user.name || membership.user.email || "U").substring(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-zinc-900">
                            {membership.user.name || "Unknown User"}
                          </span>
                          <span className="text-xs text-zinc-500">{membership.user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">
                        {membership.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-zinc-500">
                      {new Date(membership.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

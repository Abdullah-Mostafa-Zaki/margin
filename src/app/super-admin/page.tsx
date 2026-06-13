export const dynamic = 'force-dynamic';

import { unstable_noStore as noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { OrganizationsTable } from './organizations-table';

const safeAmount = (value: number | null | undefined) => value ?? 0;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(value);

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  noStore();

  const session = await getServerSession(authOptions);

  if (!process.env.SUPER_ADMIN_EMAIL) {
    redirect('/');
  }

  if (!session?.user?.email || session.user.email !== process.env.SUPER_ADMIN_EMAIL) {
    redirect('/');
  }

  try {
    const params = await searchParams;
    const range = params.range || 'month';
    
    const now = new Date();
    let startDate = new Date(0);
    if (range === 'today') {
      startDate = new Date(now.setHours(0, 0, 0, 0));
    } else if (range === 'week') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else if (range === 'month') {
      startDate = new Date(now.setDate(now.getDate() - 30));
    }

    const [
      totalOrgs,
      totalTransactions,
      globalVolume,
      globalTrappedCOD,
      newOrgsWeek,
      newOrgsMonth,
      recentOrgs,
      productUsage,
      freePlanPipeline,
      completedOnboarding,
      droppedOffNoOrg,
      droppedOffIncomplete,
    ] = await Promise.all([
      // STATIC CARDS
      prisma.organization.count(),
      prisma.transaction.count(),
      prisma.transaction.aggregate({
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          status: 'PENDING',
          paymentMethod: 'COD',
        },
      }),
      prisma.organization.count({
        where: { createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 7)) } }
      }),
      prisma.organization.count({
        where: { createdAt: { gte: new Date(new Date().setDate(new Date().getDate() - 30)) } }
      }),
      prisma.organization.findMany({
        orderBy: { currentMonthReceipts: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          updatedAt: true,
          plan: true,
          currentMonthReceipts: true,
          currentMonthVoice: true,
          currentMonthImage: true,
          currentMonthText: true,
        },
      }),

      // FILTERED METRICS
      (prisma.transaction as any).groupBy({
        by: ['source'],
        _count: true,
        where: { createdAt: { gte: startDate } }
      }),
      prisma.organization.findMany({
        where: { plan: 'FREE', updatedAt: { gte: startDate } },
        orderBy: { currentMonthReceipts: 'desc' },
        select: {
          id: true,
          name: true,
          updatedAt: true,
          currentMonthReceipts: true,
          currentMonthVoice: true,
          memberships: {
            where: { role: 'ADMIN' },
            include: { user: { select: { email: true } } }
          }
        }
      }),
      prisma.organization.count({
        where: { createdAt: { gte: startDate }, onboardingCompleted: true } as any
      }),
      prisma.user.count({
        where: { createdAt: { gte: startDate }, memberships: { none: {} } }
      }),
      prisma.organization.count({
        where: { createdAt: { gte: startDate }, onboardingCompleted: false } as any
      })
    ]);

    const volumeAmount = safeAmount(Number(globalVolume._sum.amount));
    const trappedAmount = safeAmount(Number(globalTrappedCOD._sum.amount));

    // Calculate Total API Burn
    const totalApiBurn = recentOrgs.reduce((acc, org) => {
      return acc + (org.currentMonthReceipts || 0) + (org.currentMonthVoice || 0);
    }, 0);

    // Calculate MRR
    const planPrices = {
      FREE: 0,
      PLUS: 0,
      PRO: 0,
      BUSINESS: 0,
    };
    
    const totalMRR = recentOrgs.reduce((acc, org) => {
      return acc + (planPrices[org.plan] || 0);
    }, 0);

    const usageMap = (productUsage as any[]).reduce((acc, item) => {
      acc[item.source] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">⚡ Super Admin</h1>
          <p className="text-zinc-500 mt-1">
            Global platform overview &mdash; internal use only.
          </p>
        </div>

        {/* Top Metric Cards (Static) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                Total Organizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalOrgs.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                Total Transactions Logged
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalTransactions.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                Total EGP Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(volumeAmount)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                Total API Burn This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalApiBurn.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-800">
                Total MRR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-700">
                {formatCurrency(totalMRR)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-800">
                Global Trapped COD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-700">
                {formatCurrency(trappedAmount)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                New Orgs (Week)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{newOrgsWeek.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-500">
                New Orgs (Month)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{newOrgsMonth.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Time Filter Bar */}
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-4">
          <span className="text-sm font-medium text-zinc-500 mr-2">Filter Metrics Below:</span>
          {['today', 'week', 'month', 'all'].map((r) => (
            <Link 
              key={r} 
              href={`?range=${r}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                range === r 
                  ? 'bg-zinc-900 text-white' 
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Usage */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Product Usage</h2>
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm font-medium text-zinc-600">Manual (Form)</span>
                  <span className="font-mono">{usageMap['MANUAL'] || 0}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm font-medium text-zinc-600">Magic Box (Image)</span>
                  <span className="font-mono">{usageMap['IMPORT_IMAGE'] || 0}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-sm font-medium text-zinc-600">Magic Box (CSV)</span>
                  <span className="font-mono">{usageMap['IMPORT_CSV'] || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-zinc-600">Voice Note</span>
                  <span className="font-mono">{usageMap['VOICE'] || 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Onboarding Funnel */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Onboarding Funnel</h2>
            <Card>
              <CardContent className="p-6 space-y-6">
                <div className="flex flex-col space-y-1">
                  <span className="text-sm font-medium text-emerald-600 uppercase tracking-wider">Completed</span>
                  <span className="text-4xl font-bold">{completedOnboarding.toLocaleString()}</span>
                  <span className="text-xs text-zinc-500">Created brand & completed onboarding</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                  <div className="flex flex-col space-y-1">
                    <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Dropped (No Brand)</span>
                    <span className="text-2xl font-bold text-zinc-700">{droppedOffNoOrg.toLocaleString()}</span>
                    <span className="text-xs text-zinc-500">Signed up but didn't create an org</span>
                  </div>
                  <div className="flex flex-col space-y-1">
                    <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Dropped (Incomplete)</span>
                    <span className="text-2xl font-bold text-zinc-700">{droppedOffIncomplete.toLocaleString()}</span>
                    <span className="text-xs text-zinc-500">Created brand but didn't finish</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Revenue Pipeline */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Revenue Pipeline (FREE Plan Upsell)</h2>
          <Card>
            <CardContent className="p-0">
              <div className="rounded-md border-0 overflow-x-auto bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-50 text-zinc-500 font-medium border-b border-zinc-200">
                    <tr>
                      <th className="px-4 py-3">Org Name</th>
                      <th className="px-4 py-3 text-right">Receipt Usage</th>
                      <th className="px-4 py-3 text-right">Voice Usage</th>
                      <th className="px-4 py-3 text-right">Last Active</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {freePlanPipeline.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">No organizations found for this period.</td>
                      </tr>
                    ) : (
                      freePlanPipeline.map((org) => {
                        const isHot = org.currentMonthReceipts >= 10;
                        const adminEmail = org.memberships[0]?.user?.email || '';
                        
                        return (
                          <tr key={org.id} className={isHot ? "bg-amber-50/50" : ""}>
                            <td className="px-4 py-3 font-medium text-zinc-900">{org.name}</td>
                            <td className={`px-4 py-3 text-right font-mono ${isHot ? "text-amber-600 font-bold" : "text-zinc-600"}`}>
                              {org.currentMonthReceipts} / 15
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-zinc-600">
                              {org.currentMonthVoice} / 15
                            </td>
                            <td className="px-4 py-3 text-right text-zinc-500">
                              {org.updatedAt.toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {adminEmail && (
                                <a 
                                  href={`mailto:${adminEmail}`} 
                                  className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  Reach Out
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations Table */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Organizations
          </h2>
          <Card>
            <CardContent className="p-4 sm:p-6">
              <OrganizationsTable recentOrgs={recentOrgs.filter(org => new Date(org.updatedAt) >= startDate)} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[SuperAdmin] Data fetch failed:', error);
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-1">
            Failed to load dashboard data
          </h2>
          <p className="text-sm text-red-600">
            An unexpected error occurred while fetching platform metrics. Check server logs for details.
          </p>
        </div>
      </div>
    );
  }
}

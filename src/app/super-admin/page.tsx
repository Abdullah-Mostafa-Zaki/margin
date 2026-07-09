export const dynamic = 'force-dynamic';

import { unstable_noStore as noStore } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { PLAN_PRICES, PLAN_LIMITS } from '@/lib/plans';
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
          subscription: {
            select: { status: true }
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true }
          }
        },
      }),

      // FILTERED METRICS
      (prisma.transaction as any).groupBy({
        by: ['source'],
        _count: true,
        where: { createdAt: { gte: startDate } }
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

    // Calculate Total API Burn (Sum of all 4 types)
    const totalApiBurn = recentOrgs.reduce((acc, org) => {
      return acc + (org.currentMonthReceipts || 0) + (org.currentMonthVoice || 0) + (org.currentMonthImage || 0) + (org.currentMonthText || 0);
    }, 0);

    // Calculate Accurate MRR (Only Active Subscriptions, except Free)
    const totalMRR = recentOrgs.reduce((acc, org) => {
      // If they are on a paid plan and have an active subscription (or if we trust the plan field for manual upgrades)
      // Usually, if plan != FREE and subscription is missing, it's a manual upgrade, so we count it.
      // If subscription exists, it must be active or trailing.
      const isPaid = org.plan !== 'FREE';
      const isSubActive = !org.subscription || ['active', 'trialing'].includes(org.subscription.status);
      if (isPaid && isSubActive) {
        return acc + (PLAN_PRICES[org.plan] || 0);
      }
      return acc;
    }, 0);

    const usageMap = (productUsage as any[]).reduce((acc, item) => {
      acc[item.source] = item._count;
      return acc;
    }, {} as Record<string, number>);

    // Process orgs for display
    const processedOrgs = recentOrgs.map(org => {
      const totalUsage = (org.currentMonthReceipts || 0) + (org.currentMonthVoice || 0) + (org.currentMonthImage || 0) + (org.currentMonthText || 0);
      const limit = PLAN_LIMITS[org.plan].maxAiTransactions;
      const usagePercentage = limit > 0 ? (totalUsage / limit) * 100 : 0;
      const lastActive = org.transactions[0]?.createdAt || org.createdAt;
      
      return {
        ...org,
        totalUsage,
        limit,
        usagePercentage,
        lastActive,
        hasTransactions: org.transactions.length > 0
      };
    });

    const topBurners = [...processedOrgs].sort((a, b) => b.totalUsage - a.totalUsage).slice(0, 3);
    const hotUpsells = processedOrgs
      .filter(org => org.plan === 'FREE')
      .sort((a, b) => b.usagePercentage - a.usagePercentage)
      .slice(0, 5);

    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">⚡ Super Admin</h1>
            <p className="text-zinc-500 mt-1">
              Global platform overview &mdash; internal use only.
            </p>
          </div>
          {/* Time Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-zinc-500 mr-2">Filter Metrics:</span>
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
        </div>

        {/* 1. The Action Center (Top Row) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Groq Risk */}
          <Card className="border-red-100 bg-red-50/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-zinc-800 flex justify-between">
                <span>🔥 Groq Risk (Quota Burn)</span>
                <span className="text-red-600">{totalApiBurn.toLocaleString()}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full bg-zinc-200 rounded-full h-2 mb-4">
                <div 
                  className="bg-red-500 h-2 rounded-full" 
                  style={{ width: `${Math.min((totalApiBurn / 100000) * 100, 100)}%` }} 
                />
              </div>
              <p className="text-xs text-zinc-500 mb-3">Top burners this period:</p>
              <div className="space-y-2">
                {topBurners.map(org => (
                  <div key={org.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium truncate max-w-[150px]">{org.name}</span>
                    <span className="font-mono text-zinc-600">{org.totalUsage.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Hot Upsells */}
          <Card className="border-amber-100 bg-amber-50/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-amber-800">
                🚀 Hot Upsells (FREE Plan)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hotUpsells.length === 0 ? (
                <p className="text-sm text-zinc-500 mt-2">No hot upsells found.</p>
              ) : (
                <div className="space-y-3 mt-1">
                  {hotUpsells.map(org => (
                    <div key={org.id} className="flex flex-col text-sm border-b border-amber-100 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center font-medium">
                        <span className="truncate max-w-[150px]">{org.name}</span>
                        <span className={`${org.usagePercentage >= 100 ? 'text-red-600 font-bold' : 'text-amber-700'}`}>
                          {Math.round(org.usagePercentage)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-xs text-zinc-500">
                        <span>{org.totalUsage} / {org.limit} AI</span>
                        <a 
                          href={`/${org.slug}`} 
                          className="text-blue-600 hover:underline"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Platform MRR & COD */}
          <div className="space-y-6">
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-800">
                  Active Platform MRR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-emerald-700">
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
          </div>
        </div>

        {/* 2. Master Organizations Table */}
        <div>
          <Card>
            <CardContent className="p-0">
              {/* Note: Pass all processedOrgs; the filtering by date is better handled inside or kept out so we can see all orgs,
                  but for now we pass the filtered ones or all of them. The user wants to see them for management. */}
              <OrganizationsTable recentOrgs={processedOrgs as any} />
            </CardContent>
          </Card>
        </div>

        {/* 3. Analytics (Collapsible / Bottom) */}
        <details className="group border border-zinc-200 rounded-xl bg-white [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer flex-col sm:flex-row items-start sm:items-center justify-between p-6 font-semibold text-zinc-900 gap-2 sm:gap-0">
            <span>📊 View Secondary Analytics (Onboarding & Product Usage)</span>
            <span className="transition group-open:-rotate-180 self-end sm:self-auto">
              <svg fill="none" height="24" shapeRendering="geometricPrecision" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="24"><path d="M6 9l6 6 6-6"></path></svg>
            </span>
          </summary>
          <div className="p-6 pt-0 border-t border-zinc-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-500">Total Organizations</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{totalOrgs.toLocaleString()}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-500">Total Transactions</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{totalTransactions.toLocaleString()}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-zinc-500">Total EGP Volume</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatCurrency(volumeAmount)}</p></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Product Usage */}
              <div>
                <h2 className="text-lg font-semibold mb-3">Product Usage ({range})</h2>
                <Card>
                  <CardContent className="p-5 space-y-3">
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
                <h2 className="text-lg font-semibold mb-3">Onboarding Funnel ({range})</h2>
                <Card>
                  <CardContent className="p-5 space-y-5">
                    <div className="flex flex-col space-y-1">
                      <span className="text-sm font-medium text-emerald-600 uppercase tracking-wider">Completed</span>
                      <span className="text-3xl font-bold">{completedOnboarding.toLocaleString()}</span>
                      <span className="text-xs text-zinc-500">Created brand & completed onboarding</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
                      <div className="flex flex-col space-y-1">
                        <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Dropped (No Brand)</span>
                        <span className="text-xl font-bold text-zinc-700">{droppedOffNoOrg.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span className="text-xs font-medium text-amber-600 uppercase tracking-wider">Dropped (Incomplete)</span>
                        <span className="text-xl font-bold text-zinc-700">{droppedOffIncomplete.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </details>
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

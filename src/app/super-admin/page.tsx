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
import { Badge } from '@/components/ui/badge';
import { PLAN_LIMITS } from '@/lib/plans';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const safeAmount = (value: number | null | undefined) => value ?? 0;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(value);

export default async function SuperAdminPage() {
  noStore();

  const session = await getServerSession(authOptions);

  if (!process.env.SUPER_ADMIN_EMAIL) {
    redirect('/');
  }

  if (!session?.user?.email || session.user.email !== process.env.SUPER_ADMIN_EMAIL) {
    redirect('/');
  }

  try {
    const [
      totalOrgs,
      totalUsers,
      globalVolume,
      globalTrappedCOD,
      recentOrgs,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
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
        },
      }),
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
      ENTERPRISE: 0,
    };
    
    const totalMRR = recentOrgs.reduce((acc, org) => {
      return acc + (planPrices[org.plan] || 0);
    }, 0);

    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">⚡ Super Admin</h1>
          <p className="text-zinc-500 mt-1">
            Global platform overview &mdash; internal use only.
          </p>
        </div>

        {/* Metric Cards */}
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
        </div>

        {/* Organizations Table */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Organizations
          </h2>
          <Card>
            <CardContent className="p-0">
              {recentOrgs.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-zinc-400">
                  No organizations found.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead className="text-right">Receipt Usage</TableHead>
                      <TableHead className="text-right">Voice Usage</TableHead>
                      <TableHead className="text-right">Last Active</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrgs.map((org) => {
                      const limits = PLAN_LIMITS[org.plan];
                      const receiptLimitStr = limits.maxAiReceipts === Infinity ? '∞' : limits.maxAiReceipts;
                      const voiceLimitStr = limits.maxAiVoice === Infinity ? '∞' : limits.maxAiVoice;
                      
                      const planColors: Record<string, string> = {
                        FREE: 'bg-zinc-100 text-zinc-800',
                        PLUS: 'bg-blue-100 text-blue-800',
                        PRO: 'bg-purple-100 text-purple-800',
                        ENTERPRISE: 'bg-amber-100 text-amber-800',
                      };

                      return (
                        <TableRow key={org.id}>
                          <TableCell className="font-medium">
                            {org.name}
                          </TableCell>
                          <TableCell className="text-zinc-500 font-mono text-sm">
                            {org.slug}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`border-transparent ${planColors[org.plan]}`}>
                              {org.plan}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {org.currentMonthReceipts} / {receiptLimitStr}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {org.currentMonthVoice} / {voiceLimitStr}
                          </TableCell>
                          <TableCell className="text-right text-zinc-500 text-sm">
                            {org.updatedAt.toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/${org.slug}`}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            >
                              Ghost Login
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
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

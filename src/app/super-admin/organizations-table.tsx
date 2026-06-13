'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { PLAN_LIMITS } from '@/lib/plans';
import { Plan } from '@prisma/client';
import { updatePlan, resetUsage } from './actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const planColors: Record<string, string> = {
  FREE: 'bg-zinc-100 text-zinc-800',
  PLUS: 'bg-blue-100 text-blue-800',
  PRO: 'bg-purple-100 text-purple-800',
  BUSINESS: 'bg-amber-100 text-amber-800',
};

type OrgType = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  plan: Plan;
  currentMonthReceipts: number;
  currentMonthVoice: number;
  currentMonthImage: number;
  currentMonthText: number;
};

export function OrganizationsTable({ recentOrgs }: { recentOrgs: OrgType[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();

  const filteredOrgs = recentOrgs.filter((org) => {
    const term = searchTerm.toLowerCase();
    return (
      org.name.toLowerCase().includes(term) ||
      org.slug.toLowerCase().includes(term)
    );
  });

  const handlePlanChange = (orgId: string, newPlan: Plan | null) => {
    if (!newPlan) return;
    startTransition(() => {
      updatePlan(orgId, newPlan);
    });
  };

  const handleResetUsage = (orgId: string) => {
    if (window.confirm('Are you sure you want to reset usage for this organization?')) {
      startTransition(() => {
        resetUsage(orgId);
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <Input
          placeholder="Filter by name or slug..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="rounded-md border overflow-x-auto bg-white">
        {filteredOrgs.length === 0 ? (
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
                <TableHead className="text-right">AI Usage</TableHead>
                <TableHead className="text-right">Last Active</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrgs.map((org) => {
                const limits = PLAN_LIMITS[org.plan];
                const txLimitStr =
                  limits.maxAiTransactions >= 999999 ? '∞' : limits.maxAiTransactions;
                const totalUsage = org.currentMonthVoice + org.currentMonthImage + org.currentMonthText;

                return (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <div 
                        className={`w-2 h-2 rounded-full ${
                          (new Date().getTime() - new Date(org.updatedAt).getTime()) / (1000 * 3600 * 24) <= 7 ? 'bg-green-500' :
                          (new Date().getTime() - new Date(org.updatedAt).getTime()) / (1000 * 3600 * 24) <= 30 ? 'bg-yellow-400' :
                          'bg-red-500'
                        }`}
                        title="Activity Status"
                      />
                      {org.name}
                    </TableCell>
                    <TableCell className="text-zinc-500 font-mono text-sm">
                      {org.slug}
                    </TableCell>
                    <TableCell>
                      <Select
                        defaultValue={org.plan}
                        onValueChange={(val: Plan | null) => handlePlanChange(org.id, val)}
                        disabled={isPending}
                      >
                        <SelectTrigger
                          className={`h-6 text-xs font-semibold w-[120px] border-transparent rounded-full px-2.5 ${planColors[org.plan]}`}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FREE">FREE</SelectItem>
                          <SelectItem value="PLUS">PLUS</SelectItem>
                          <SelectItem value="PRO">PRO</SelectItem>
                          <SelectItem value="BUSINESS">BUSINESS</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <div>
                        {totalUsage} / {txLimitStr}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ({org.currentMonthVoice} Voice | {org.currentMonthImage} Img | {org.currentMonthText} Txt)
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-zinc-500 text-sm">
                      {org.updatedAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetUsage(org.id)}
                        disabled={isPending}
                        className="text-zinc-500 hover:text-zinc-900"
                      >
                        Reset Usage
                      </Button>
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
      </div>
    </div>
  );
}

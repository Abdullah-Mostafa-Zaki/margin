'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { Plan } from '@prisma/client';
import { updatePlan, resetUsage, fetchOrgActivityLog } from './actions';
import { softDeleteOrganization, restoreOrganization } from '@/actions/super-admin.actions';
import { toast } from 'sonner';
import { MoreHorizontal, ArrowUpDown, Download, Activity, Key, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { DeleteConfirmationModal } from './delete-confirmation-modal';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCairoDate } from "@/lib/date-utils";

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
  totalUsage: number;
  limit: number;
  usagePercentage: number;
  lastActive: Date;
  hasTransactions: boolean;
  deletedAt: Date | null;
};

export function OrganizationsTable({ recentOrgs }: { recentOrgs: OrgType[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isPending, startTransition] = useTransition();
  const [sortField, setSortField] = useState<'lastActive' | 'totalUsage'>('lastActive');
  const [sortDesc, setSortDesc] = useState(true);

  // Activity Log Modal State
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [activeOrgName, setActiveOrgName] = useState<string>('');
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orgToDelete, setOrgToDelete] = useState<OrgType | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredAndSortedOrgs = useMemo(() => {
    let result = recentOrgs.filter((org) => {
      const term = searchTerm.toLowerCase();
      return (
        org.name.toLowerCase().includes(term) ||
        org.slug.toLowerCase().includes(term)
      );
    });

    result.sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'lastActive') {
        aVal = new Date(a.lastActive).getTime();
        bVal = new Date(b.lastActive).getTime();
      } else {
        aVal = a.totalUsage;
        bVal = b.totalUsage;
      }
      return sortDesc ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [recentOrgs, searchTerm, sortField, sortDesc]);

  const handleSort = (field: 'lastActive' | 'totalUsage') => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  const handlePlanChange = (orgId: string, newPlan: Plan | null) => {
    if (!newPlan) return;
    startTransition(async () => {
      try {
        await updatePlan(orgId, newPlan);
        toast.success(`Plan updated to ${newPlan}`);
      } catch (error: any) {
        toast.error(`Failed to update plan: ${error.message}`);
      }
    });
  };

  const handleResetUsage = (orgId: string) => {
    if (window.confirm('Are you sure you want to reset usage for this organization?')) {
      startTransition(async () => {
        try {
          await resetUsage(orgId);
          toast.success('Usage reset successfully');
        } catch (error: any) {
          toast.error(`Failed to reset usage: ${error.message}`);
        }
      });
    }
  };

  const handleViewActivity = async (org: OrgType) => {
    setActiveOrgName(org.name);
    setIsActivityOpen(true);
    setIsLoadingActivity(true);
    setActivityLogs([]);
    try {
      const logs = await fetchOrgActivityLog(org.id);
      setActivityLogs(logs);
    } catch (error: any) {
      toast.error(`Failed to fetch activity log: ${error.message}`);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const handleDeleteClick = (org: OrgType) => {
    setOrgToDelete(org);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!orgToDelete) return;
    setIsDeleting(true);
    startTransition(async () => {
      try {
        await softDeleteOrganization(orgToDelete.id, orgToDelete.slug);
        toast.success(`Organization ${orgToDelete.name} deleted.`);
        setDeleteModalOpen(false);
      } catch (err: any) {
        toast.error(`Failed to delete: ${err.message}`);
      } finally {
        setIsDeleting(false);
        setOrgToDelete(null);
      }
    });
  };

  const handleRestoreClick = (org: OrgType) => {
    if (window.confirm(`Are you sure you want to restore ${org.name}?`)) {
      startTransition(async () => {
        try {
          await restoreOrganization(org.id, org.slug);
          toast.success(`Organization ${org.name} restored.`);
        } catch (err: any) {
          toast.error(`Failed to restore: ${err.message}`);
        }
      });
    }
  };

  const handleExportCSV = () => {
    const headers = ['Organization Name', 'Slug', 'Plan', 'Total AI Usage', 'Limit', 'Last Active', 'Signup Date'];
    const rows = filteredAndSortedOrgs.map(org => [
      org.name.replace(/,/g, ''), // escape commas
      org.slug,
      org.plan,
      org.totalUsage.toString(),
      org.limit.toString(),
      new Date(org.lastActive).toISOString(),
      new Date(org.createdAt).toISOString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `margin-orgs-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 pb-0">
        <Input
          placeholder="Filter by name or slug..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Button onClick={handleExportCSV} variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto bg-white">
        {filteredAndSortedOrgs.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-400">
            No organizations found.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-20 bg-zinc-50 shadow-[1px_0_0_rgba(0,0,0,0.1)] min-w-[200px]">Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-zinc-50" onClick={() => handleSort('totalUsage')}>
                  <div className="flex items-center justify-end gap-1">
                    AI Usage
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="text-right cursor-pointer hover:bg-zinc-50" onClick={() => handleSort('lastActive')}>
                  <div className="flex items-center justify-end gap-1">
                    True Last Active
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedOrgs.map((org) => {
                const txLimitStr = org.limit >= 999999 ? '∞' : org.limit;
                
                // Active status based on true last active date
                const daysSinceActive = (new Date().getTime() - new Date(org.lastActive).getTime()) / (1000 * 3600 * 24);
                const isSignedUp = !org.hasTransactions;
                
                return (
                  <TableRow key={org.id} className={org.deletedAt ? "opacity-50" : ""}>
                    <TableCell className="sticky left-0 z-10 bg-white shadow-[1px_0_0_rgba(0,0,0,0.1)] min-w-[200px] border-r border-zinc-100">
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium flex items-center gap-2">
                          <div 
                            className={`shrink-0 w-2 h-2 rounded-full ${
                              daysSinceActive <= 7 ? 'bg-green-500' :
                              daysSinceActive <= 30 ? 'bg-yellow-400' :
                              'bg-red-500'
                            }`}
                            title={isSignedUp ? 'Signed Up' : 'Active'}
                          />
                          <span className="truncate max-w-[140px] sm:max-w-[180px]">{org.name}</span>
                        </div>
                        <span className="text-zinc-500 font-mono text-xs pl-4 truncate max-w-[140px] sm:max-w-[180px]">
                          {org.slug}
                        </span>
                      </div>
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
                        {org.totalUsage.toLocaleString()} / {txLimitStr}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {Math.round(org.usagePercentage)}% used
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <div className={isSignedUp ? "text-zinc-400" : "text-zinc-900"}>
                        {formatCairoDate(new Date(org.lastActive), "MM/dd/yyyy")}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {isSignedUp ? 'Signed up' : 'Last action'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={(e) => {
                            e.preventDefault();
                            window.location.href = `/${org.slug}`;
                          }} className="cursor-pointer gap-2">
                            <Key className="h-4 w-4 text-zinc-500" />
                            Ghost Login
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewActivity(org)} className="cursor-pointer gap-2">
                            <Activity className="h-4 w-4 text-zinc-500" />
                            View Activity
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleResetUsage(org.id)} disabled={isPending} className="cursor-pointer text-red-600 gap-2">
                            <RotateCcw className="h-4 w-4 text-red-500" />
                            Reset Usage
                          </DropdownMenuItem>
                          {org.deletedAt ? (
                            <DropdownMenuItem onClick={() => handleRestoreClick(org)} disabled={isPending} className="cursor-pointer text-green-600 gap-2">
                              <Undo2 className="h-4 w-4 text-green-500" />
                              Restore Org
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => handleDeleteClick(org)} disabled={isPending} className="cursor-pointer text-red-600 gap-2">
                              <Trash2 className="h-4 w-4 text-red-500" />
                              Suspend / Delete Org
                            </DropdownMenuItem>
                          )}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={isActivityOpen} onOpenChange={setIsActivityOpen}>
        <DialogContent className="sm:max-w-3xl lg:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Activity Log: {activeOrgName}</DialogTitle>
          </DialogHeader>
          <div className="mt-4 max-h-[60vh] overflow-y-auto border rounded-md w-full min-w-0">
            {isLoadingActivity ? (
              <div className="p-8 text-center text-sm text-zinc-500">Loading recent activity...</div>
            ) : activityLogs.length === 0 ? (
              <div className="p-8 text-center text-sm text-zinc-500">No transactions found for this organization.</div>
            ) : (
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">{formatCairoDate(new Date(log.createdAt), "MM/dd/yyyy, h:mm:ss a")}</TableCell>
                      <TableCell className="text-xs">{log.source}</TableCell>
                      <TableCell className="text-xs font-medium">{log.type}</TableCell>
                      <TableCell className="text-xs">{log.category}</TableCell>
                      <TableCell className="text-xs">{log.paymentMethod || '-'}</TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{Number(log.amount).toLocaleString()} EGP</TableCell>
                      <TableCell className="text-xs">{log.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Suspend Organization"
        description="This will soft-delete the organization, instantly logging out all its users and blocking API/app access. Data will be retained and can be restored."
        expectedConfirmationString={orgToDelete?.slug || ''}
        isDeleting={isDeleting}
      />
    </div>
  );
}

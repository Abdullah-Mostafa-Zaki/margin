"use client";

import { RecurringToEdit } from "./recurring-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash2, Play, Power, Trash } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  deleteRecurringExpense, 
  reactivateRecurringExpense, 
  hardDeleteRecurringExpense, 
  logRecurringExpenseNow 
} from "@/app/actions/recurring.actions";
import { toast } from "sonner";
import { useState } from "react";

interface RecurringListProps {
  expenses: any[];
  selectedIds: Set<string>;
  orgSlug: string;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[], selected: boolean) => void;
  onEdit: (expense: RecurringToEdit) => void;
}

export function RecurringList({ expenses, selectedIds, orgSlug, onToggle, onSelectAll, onEdit }: RecurringListProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleAction = async (id: string, action: () => Promise<any>, successMsg: string) => {
    setLoadingId(id);
    try {
      await action();
      toast.success(successMsg);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setLoadingId(null);
    }
  };
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-32">
        <p className="text-zinc-500 font-medium">No recurring expenses found.</p>
        <p className="text-sm text-zinc-400 mt-1">Add one to automate your fixed costs.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 px-4">
              <Checkbox
                checked={
                  expenses.length > 0 && expenses.every((t) => selectedIds.has(t.id))
                    ? true
                    : expenses.some((t) => selectedIds.has(t.id))
                    ? "indeterminate"
                    : false
                }
                onCheckedChange={() => {
                  const allSelected = expenses.length > 0 && expenses.every((t) => selectedIds.has(t.id));
                  onSelectAll(expenses.map((t) => t.id), !allSelected);
                }}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="whitespace-nowrap">Name</TableHead>
            <TableHead className="whitespace-nowrap">Category</TableHead>
            <TableHead className="whitespace-nowrap">Amount</TableHead>
            <TableHead className="whitespace-nowrap">Frequency</TableHead>
            <TableHead className="whitespace-nowrap">Next Due</TableHead>
            <TableHead className="whitespace-nowrap">Status</TableHead>
            <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => {
            const nextDueStr = new Date(expense.nextDueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <TableRow key={expense.id} className="group cursor-pointer hover:bg-zinc-50 transition-colors">
                <TableCell className="w-12 px-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(expense.id)}
                    onCheckedChange={() => onToggle(expense.id)}
                    aria-label="Select row"
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap font-medium">
                  {expense.name}
                  {expense.drop && <div className="text-xs text-zinc-400 mt-1">Drop: {expense.drop.name}</div>}
                </TableCell>
                <TableCell className="whitespace-nowrap">{expense.category}</TableCell>
                <TableCell className="whitespace-nowrap font-bold">{Number(expense.amount).toLocaleString("en-EG")} EGP</TableCell>
                <TableCell className="whitespace-nowrap">{expense.frequency.charAt(0) + expense.frequency.slice(1).toLowerCase()}</TableCell>
                <TableCell className="whitespace-nowrap">{nextDueStr}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {expense.isActive ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-800">
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger disabled={loadingId === expense.id}>
                      <div className={`h-8 w-8 p-0 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-zinc-100 cursor-pointer ${loadingId === expense.id ? 'opacity-50' : ''}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(expense as RecurringToEdit)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      
                      {expense.isActive ? (
                        <>
                          <DropdownMenuItem onClick={() => handleAction(expense.id, () => logRecurringExpenseNow(orgSlug, expense.id), "Logged transaction successfully")}>
                            <Play className="mr-2 h-4 w-4" />
                            Log Now
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-amber-600 focus:text-amber-600 focus:bg-amber-50" onClick={() => {
                            if (confirm("Are you sure you want to deactivate this recurring expense?")) {
                              handleAction(expense.id, () => deleteRecurringExpense(orgSlug, expense.id), "Deactivated successfully");
                            }
                          }}>
                            <Power className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-50" onClick={() => handleAction(expense.id, () => reactivateRecurringExpense(orgSlug, expense.id), "Reactivated successfully")}>
                            <Power className="mr-2 h-4 w-4" />
                            Reactivate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      
                      <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={() => {
                        if (confirm("Are you sure you want to permanently delete this recurring expense? This action cannot be undone.")) {
                          handleAction(expense.id, () => hardDeleteRecurringExpense(orgSlug, expense.id), "Deleted permanently");
                        }
                      }}>
                        <Trash className="mr-2 h-4 w-4" />
                        Delete Permanently
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

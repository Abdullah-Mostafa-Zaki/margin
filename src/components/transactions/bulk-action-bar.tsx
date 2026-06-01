"use client";

import { useState } from "react";
import { Loader2, Trash } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { bulkAssignDrop, bulkUpdateStatus, bulkDeleteTransactions, bulkUpdateFulfillmentStatus } from "@/actions/transactions.actions";
import { FulfillmentStatus } from "@prisma/client";
import { toast } from "sonner";

interface BulkActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  tags: { id: string; name: string }[];
  orgSlug: string;
  onDismiss: () => void;
}

export function BulkActionBar({
  selectedCount,
  selectedIds,
  tags,
  orgSlug,
  onDismiss,
}: BulkActionBarProps) {
  const [isLoading, setIsLoading] = useState(false);

  if (selectedCount === 0) return null;

  const handleAssignDrop = async (tagId: string | null) => {
    if (!tagId) return;
    setIsLoading(true);
    try {
      await bulkAssignDrop(selectedIds, tagId, orgSlug);
      toast.success(`Assigned drop to ${selectedCount} transactions`);
      onDismiss();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign drop");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateFulfillment = async (status: string | null) => {
    if (!status) return;
    setIsLoading(true);
    try {
      await bulkUpdateFulfillmentStatus(selectedIds, status as FulfillmentStatus, orgSlug);
      toast.success(`Updated fulfillment status for ${selectedCount} transactions`);
      onDismiss();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update fulfillment status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: "PENDING" | "RECEIVED") => {
    setIsLoading(true);
    try {
      await bulkUpdateStatus(selectedIds, status, orgSlug);
      toast.success(`Marked ${selectedCount} transactions as ${status}`);
      onDismiss();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      await bulkDeleteTransactions(selectedIds, orgSlug);
      toast.success(`Deleted ${selectedCount} transactions`);
      onDismiss();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete transactions");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-full bg-zinc-900 px-6 py-3 shadow-xl text-white">
      <span className="text-sm font-medium whitespace-nowrap">
        {selectedCount} selected
      </span>
      
      <div className="h-4 w-px bg-zinc-700 mx-1" />

      <div className="flex items-center gap-2">
        <Select disabled={isLoading} onValueChange={handleAssignDrop}>
          <SelectTrigger className="h-8 border-zinc-700 bg-zinc-800 text-xs text-white hover:bg-zinc-700 focus:ring-0 focus:ring-offset-0">
            <SelectValue placeholder="Assign Drop" />
          </SelectTrigger>
          <SelectContent>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={tag.id}>
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select disabled={isLoading} onValueChange={handleUpdateFulfillment}>
          <SelectTrigger className="h-8 border-zinc-700 bg-zinc-800 text-xs text-white hover:bg-zinc-700 focus:ring-0 focus:ring-offset-0">
            <SelectValue placeholder="Fulfillment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UNFULFILLED">Unfulfilled</SelectItem>
            <SelectItem value="SHIPPED">Shipped</SelectItem>
            <SelectItem value="DELIVERED">Delivered</SelectItem>
            <SelectItem value="RETURNED">Returned</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => handleUpdateStatus("RECEIVED")}
          className="h-8 border-zinc-700 bg-zinc-800 text-xs text-white hover:bg-zinc-700 hover:text-white"
        >
          {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Mark Received
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={() => handleUpdateStatus("PENDING")}
          className="h-8 border-zinc-700 bg-zinc-800 text-xs text-white hover:bg-zinc-700 hover:text-white"
        >
          {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          Mark Pending
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              disabled={isLoading}
              className="h-8 w-8 ml-1 rounded-full bg-red-600 hover:bg-red-700 border-0"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin text-white" />
              ) : (
                <Trash className="h-3 w-3 text-white" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete {selectedCount} selected transaction(s).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

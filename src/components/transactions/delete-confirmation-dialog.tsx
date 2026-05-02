"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteTransaction } from "@/actions/transactions.actions";

export function DeleteConfirmationDialog({ id, orgSlug, className }: { id: string; orgSlug: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          size="sm"
          className={className}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this transaction? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={(e) => {
            e.stopPropagation();
            setOpen(false);
          }} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={(e) => {
              e.stopPropagation();
              startTransition(async () => {
                await deleteTransaction(id, orgSlug);
                setOpen(false);
              });
            }}
          >
            {isPending ? "..." : "Confirm Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

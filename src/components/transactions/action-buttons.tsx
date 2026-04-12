"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateTransactionStatus, deleteTransaction, markAllPendingAsReceived } from "@/actions/transactions.actions";

export function MarkReceivedButton({ id, orgSlug }: { id: string; orgSlug: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await updateTransactionStatus(id, "RECEIVED", orgSlug);
        });
      }}
    >
      {isPending ? "Updating..." : "Mark as Received"}
    </Button>
  );
}

export function DeleteTransactionButton({ id, orgSlug }: { id: string; orgSlug: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (confirm("Are you sure you want to delete this transaction?")) {
          startTransition(async () => {
            await deleteTransaction(id, orgSlug);
          });
        }
      }}
    >
      {isPending ? "..." : "Delete"}
    </Button>
  );
}

export function MarkAllReceivedButton({ orgSlug }: { orgSlug: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await markAllPendingAsReceived(orgSlug);
        });
      }}
    >
      {isPending ? "Updating..." : "Mark ALL as Received"}
    </Button>
  );
}

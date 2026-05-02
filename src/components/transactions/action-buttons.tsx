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

export { DeleteConfirmationDialog as DeleteTransactionButton } from "./delete-confirmation-dialog";

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

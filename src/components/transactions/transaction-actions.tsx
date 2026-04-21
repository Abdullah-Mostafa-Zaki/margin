"use client";

import { useRef } from "react";
import TransactionForm from "@/components/transactions/transaction-form";
import type { TransactionFormHandle, TransactionToEdit } from "@/components/transactions/transaction-form";
import { MagicVoiceButton } from "@/components/transactions/magic-voice-button";
import type { VoiceTransactionData } from "@/components/transactions/magic-voice-button";
import { CSVUploader } from "@/components/dashboard/CSVUploader";

interface TagProp {
  id: string;
  name: string;
}

interface TransactionActionsProps {
  orgSlug: string;
  orgId: string;
  tags: TagProp[];
  /** Called with the form ref so parent can wire row-clicks to openForEdit */
  onFormReady?: (handle: TransactionFormHandle) => void;
}

/**
 * Client wrapper that coordinates MagicVoiceButton and TransactionForm.
 * The voice button captures audio → AI extracts data → opens the form pre-filled.
 * Also exposes the form handle via onFormReady so sibling islands can trigger edit mode.
 */
export function TransactionActions({ orgSlug, orgId, tags, onFormReady }: TransactionActionsProps) {
  const formRef = useRef<TransactionFormHandle>(null);

  const handleVoiceResult = (data: VoiceTransactionData) => {
    formRef.current?.openWithDefaults({
      amount: data.amount,
      type: data.type,
      category: data.category,
      paymentMethod: data.paymentMethod,
      date: data.date,
      notes: data.notes,
    });
  };

  return (
    <div className="flex items-center gap-2">
      <CSVUploader orgId={orgId} />
      <MagicVoiceButton onResult={handleVoiceResult} />
      <TransactionForm
        ref={(handle) => {
          // Keep our local ref in sync
          (formRef as any).current = handle;
          // Notify parent shell so it can wire row clicks
          if (handle && onFormReady) onFormReady(handle);
        }}
        orgSlug={orgSlug}
        tags={tags}
      />
    </div>
  );
}

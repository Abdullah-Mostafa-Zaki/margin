"use client";

import { useRef } from "react";
import TransactionForm from "@/components/transactions/transaction-form";
import type { TransactionFormHandle } from "@/components/transactions/transaction-form";
import { MagicVoiceButton } from "@/components/transactions/magic-voice-button";
import type { VoiceTransactionData } from "@/components/transactions/magic-voice-button";

interface TagProp {
  id: string;
  name: string;
}

/**
 * Client wrapper that coordinates MagicVoiceButton and TransactionForm.
 * The voice button captures audio → AI extracts data → opens the form pre-filled.
 */
export function TransactionActions({ orgSlug, tags }: { orgSlug: string; tags: TagProp[] }) {
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
    <>
      <MagicVoiceButton onResult={handleVoiceResult} />
      <TransactionForm ref={formRef} orgSlug={orgSlug} tags={tags} />
    </>
  );
}

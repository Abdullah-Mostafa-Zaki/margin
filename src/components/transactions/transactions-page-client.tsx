"use client";

import { useState } from "react";
import type { Transaction } from "@prisma/client";
import { CodEscrowCard } from "@/components/transactions/cod-escrow-card";
import { TransactionsShell } from "@/components/transactions/transactions-shell";
import { BulkActionBar } from "@/components/transactions/bulk-action-bar";
import { RecurringBulkActionBar } from "@/components/transactions/recurring-bulk-action-bar";

interface TransactionsPageClientProps {
  codTransactions: {
    id: string;
    amount: any;
    date: Date;
    notes: string | null;
  }[];
  totalPendingCod: number;
  showCodCard: boolean;
  transactions: Transaction[];
  recurringExpenses?: any[];
  orgSlug: string;
  orgId: string;
  tags: { id: string; name: string }[];
  activeTagLabel?: string;
  currentPage?: number;
  totalPages?: number;
}

export function TransactionsPageClient({
  codTransactions,
  totalPendingCod,
  showCodCard,
  transactions,
  recurringExpenses = [],
  orgSlug,
  orgId,
  tags,
  activeTagLabel,
  currentPage = 1,
  totalPages = 1,
}: TransactionsPageClientProps) {
  const [activeTab, setActiveTab] = useState<"INCOME" | "EXPENSE" | "RECURRING">("INCOME");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleTabChange = (tab: "INCOME" | "EXPENSE" | "RECURRING") => {
    setActiveTab(tab);
    setSelectedIds(new Set()); // Clear selection when switching tabs
  };

  const toggleId = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const selectMany = (ids: string[], selected: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (selected ? next.add(id) : next.delete(id)));
      return next;
    });

  return (
    <>
      {showCodCard && (
        <CodEscrowCard
          transactions={codTransactions}
          totalPendingCod={totalPendingCod}
          orgSlug={orgSlug}
          tags={tags}
          selectedIds={selectedIds}
          onToggle={toggleId}
          onSelectAll={selectMany}
        />
      )}
      <TransactionsShell
        transactions={transactions}
        recurringExpenses={recurringExpenses}
        orgSlug={orgSlug}
        orgId={orgId}
        tags={tags}
        activeTagLabel={activeTagLabel}
        selectedIds={selectedIds}
        onToggle={toggleId}
        onSelectAll={selectMany}
        currentPage={currentPage}
        totalPages={totalPages}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      {activeTab === "RECURRING" ? (
        <RecurringBulkActionBar
          selectedCount={selectedIds.size}
          selectedIds={[...selectedIds]}
          orgSlug={orgSlug}
          onDismiss={() => setSelectedIds(new Set())}
        />
      ) : (
        <BulkActionBar
          selectedCount={selectedIds.size}
          selectedIds={[...selectedIds]}
          tags={tags}
          orgSlug={orgSlug}
          onDismiss={() => setSelectedIds(new Set())}
        />
      )}
    </>
  );
}

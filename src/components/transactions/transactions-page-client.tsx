"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { Transaction } from "@prisma/client";
import { CodEscrowCard } from "@/components/transactions/cod-escrow-card";
import { TransactionsShell } from "@/components/transactions/transactions-shell";
import { BulkActionBar } from "@/components/transactions/bulk-action-bar";
import { RecurringBulkActionBar } from "@/components/transactions/recurring-bulk-action-bar";
import { fetchTransactionsTabData } from "@/actions/transactions.actions";
import { Loader2 } from "lucide-react";

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
  activeTab: "INCOME" | "EXPENSE" | "RECURRING";
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
  activeTab,
}: TransactionsPageClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The filter key represents the current state of filters and pagination
  const filterKey = `${searchParams.get("tag") || ""}-${searchParams.get("from") || ""}-${searchParams.get("to") || ""}-${searchParams.get("page") || "1"}`;

  const [activeTabState, setActiveTabState] = useState(activeTab);
  const [isLoading, setIsLoading] = useState(false);
  const [tabCache, setTabCache] = useState<Record<string, any>>({
    [`${activeTab}-${filterKey}`]: {
      transactions,
      recurringExpenses,
      totalPages,
      currentPage
    }
  });

  // Keep cache synced with fresh data from server when URL changes (e.g., date filter applied)
  useEffect(() => {
    setActiveTabState(activeTab);
    setTabCache(prev => ({
      ...prev,
      [`${activeTab}-${filterKey}`]: {
        transactions,
        recurringExpenses,
        totalPages,
        currentPage
      }
    }));
  }, [activeTab, filterKey, transactions, recurringExpenses, totalPages, currentPage]);

  const handleTabChange = async (tab: "INCOME" | "EXPENSE" | "RECURRING") => {
    setSelectedIds(new Set()); // Clear selection when switching tabs
    
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.set("page", "1");
    
    // Compute the new cache key that would result from switching tabs (page is reset to 1)
    const newFilterKey = `${params.get("tag") || ""}-${params.get("from") || ""}-${params.get("to") || ""}-${params.get("page") || "1"}`;
    const cacheKey = `${tab}-${newFilterKey}`;

    setActiveTabState(tab);
    window.history.pushState(null, "", `${pathname}?${params.toString()}`);

    if (tabCache[cacheKey]) {
      return; // Instant switch via cache
    }

    setIsLoading(true);
    try {
      const data = await fetchTransactionsTabData({
        orgSlug,
        tab,
        tagFilter: params.get("tag") || undefined,
        startDate: params.get("from") || undefined,
        endDate: params.get("to") || undefined,
        page: 1,
        take: 50
      });

      setTabCache(prev => ({
        ...prev,
        [cacheKey]: {
          transactions: data.transactions,
          recurringExpenses: data.recurringExpenses,
          totalPages: tab === "RECURRING" ? 1 : Math.ceil(data.totalCount / 50),
          currentPage: 1
        }
      }));
    } catch (err) {
      console.error("Failed to fetch tab data", err);
    } finally {
      setIsLoading(false);
    }
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

  const currentCacheKey = `${activeTabState}-${filterKey}`;
  const currentData = tabCache[currentCacheKey] || {
    transactions: [],
    recurringExpenses: [],
    totalPages: 1,
    currentPage: 1
  };

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
      <div className={`relative transition-opacity duration-200 ${isLoading ? "opacity-50 pointer-events-none" : ""}`}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        )}
        <TransactionsShell
          transactions={currentData.transactions}
          recurringExpenses={currentData.recurringExpenses}
          orgSlug={orgSlug}
          orgId={orgId}
          tags={tags}
          activeTagLabel={activeTagLabel}
          selectedIds={selectedIds}
          onToggle={toggleId}
          onSelectAll={selectMany}
          currentPage={currentData.currentPage}
          totalPages={currentData.totalPages}
          activeTab={activeTabState}
          onTabChange={handleTabChange}
        />
      </div>
      {activeTabState === "RECURRING" ? (
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

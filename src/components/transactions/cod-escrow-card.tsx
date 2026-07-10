"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCairoDate } from "@/lib/date-utils";
import { MarkReceivedButton, MarkAllReceivedButton, MarkReturnedButton } from "@/components/transactions/action-buttons";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { fetchPendingCODTransactions } from "@/actions/transactions.actions";

interface CodEscrowCardProps {
  transactions: {
    id: string;
    amount: any;
    date: Date;
    notes: string | null;
  }[];
  orgSlug: string;
  tags: { id: string; name: string }[];
  totalPendingCod: number;
  totalPendingCodCount: number;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[], selected: boolean) => void;
}

export function CodEscrowCard({
  transactions,
  orgSlug,
  tags,
  totalPendingCod,
  totalPendingCodCount,
  selectedIds,
  onToggle,
  onSelectAll,
}: CodEscrowCardProps) {
  const [displayedTransactions, setDisplayedTransactions] = useState(transactions);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [skip, setSkip] = useState(10);

  // Sync with server updates (e.g. marking as received resets the list)
  useEffect(() => {
    setDisplayedTransactions(transactions);
    setSkip(10);
  }, [transactions]);

  const handleShowMore = async () => {
    setIsLoadingMore(true);
    try {
      const nextBatch = await fetchPendingCODTransactions({ orgSlug, skip, take: 10 });
      setDisplayedTransactions(prev => [...prev, ...nextBatch]);
      setSkip(prev => prev + 10);
    } catch (err) {
      console.error("Failed to load more COD transactions:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const allSelected = displayedTransactions.length > 0 && displayedTransactions.every((t) => selectedIds.has(t.id));
  const someSelected = displayedTransactions.some((t) => selectedIds.has(t.id));
  const indeterminate = someSelected && !allSelected;

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={allSelected ? true : indeterminate ? "indeterminate" : false}
            onCheckedChange={() => {
              onSelectAll(
                displayedTransactions.map((t) => t.id),
                !allSelected
              );
            }}
            aria-label="Select all pending COD"
          />
          <div>
            <CardTitle className="text-amber-900 flex items-center gap-2">
              Pending COD Escrow
              <span className="text-xs font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                {totalPendingCodCount} Pending Orders
              </span>
            </CardTitle>
            <p className="text-sm text-amber-700 mt-1">
              Total pending amount: <span className="font-bold text-lg">EGP {totalPendingCod.toLocaleString()}</span>
            </p>
          </div>
        </div>
        <MarkAllReceivedButton orgSlug={orgSlug} />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayedTransactions.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm border border-amber-100"
            >
              <div className="flex items-center gap-4">
                <div onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(t.id)}
                    onCheckedChange={() => onToggle(t.id)}
                    aria-label={`Select transaction ${t.id}`}
                  />
                </div>
                <div>
                  <div className="font-medium text-amber-900">
                    EGP {Number(t.amount).toLocaleString()}
                  </div>
                  <div className="text-sm text-amber-600">
                    {formatCairoDate(new Date(t.date), "d MMM yyyy")} • {t.notes || "No courier specified"}
                  </div>
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                <MarkReturnedButton id={t.id} orgSlug={orgSlug} />
                <MarkReceivedButton id={t.id} orgSlug={orgSlug} />
              </div>
            </div>
          ))}

          {displayedTransactions.length < totalPendingCodCount && (
            <div className="pt-2 pb-1 flex justify-center">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-amber-700 border-amber-200 hover:bg-amber-100 w-full max-w-xs"
                onClick={handleShowMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Show More
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

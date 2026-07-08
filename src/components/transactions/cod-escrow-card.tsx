"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkReceivedButton, MarkAllReceivedButton, MarkReturnedButton } from "@/components/transactions/action-buttons";
import { Checkbox } from "@/components/ui/checkbox";

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
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[], selected: boolean) => void;
}

export function CodEscrowCard({
  transactions,
  orgSlug,
  tags,
  totalPendingCod,
  selectedIds,
  onToggle,
  onSelectAll,
}: CodEscrowCardProps) {
  const allSelected = transactions.length > 0 && transactions.every((t) => selectedIds.has(t.id));
  const someSelected = transactions.some((t) => selectedIds.has(t.id));
  const indeterminate = someSelected && !allSelected;

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-4">
          <Checkbox
            checked={allSelected ? true : indeterminate ? "indeterminate" : false}
            onCheckedChange={() => {
              onSelectAll(
                transactions.map((t) => t.id),
                !allSelected
              );
            }}
            aria-label="Select all pending COD"
          />
          <div>
            <CardTitle className="text-amber-900">Pending COD Escrow</CardTitle>
            <p className="text-sm text-amber-700 mt-1">
              Total pending amount: <span className="font-bold text-lg">EGP {totalPendingCod.toLocaleString()}</span>
            </p>
          </div>
        </div>
        <MarkAllReceivedButton orgSlug={orgSlug} />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.map((t) => (
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
                    {new Date(t.date).toLocaleDateString()} • {t.notes || "No courier specified"}
                  </div>
                </div>
              </div>
              <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-2">
                <MarkReturnedButton id={t.id} orgSlug={orgSlug} />
                <MarkReceivedButton id={t.id} orgSlug={orgSlug} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

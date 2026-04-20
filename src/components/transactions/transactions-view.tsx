"use client";

import { useState } from "react";
import type { Transaction } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteTransactionButton } from "@/components/transactions/action-buttons";
import { MobileTransactionCard } from "@/components/transactions/mobile-transaction-card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TransactionsViewProps {
  transactions: Transaction[];
  orgSlug: string;
  activeTagLabel?: string;
}

export function TransactionsView({
  transactions,
  orgSlug,
  activeTagLabel,
}: TransactionsViewProps) {
  const [activeTab, setActiveTab] = useState<"INCOME" | "EXPENSE">("INCOME");

  const displayedTransactions = transactions.filter(
    (t) => t.type === activeTab
  );

  const incomeCount = transactions.filter((t) => t.type === "INCOME").length;
  const expenseCount = transactions.filter((t) => t.type === "EXPENSE").length;

  const emptyMessage =
    activeTab === "INCOME"
      ? activeTagLabel
        ? `No revenue recorded for "${activeTagLabel}".`
        : "No revenue recorded yet."
      : activeTagLabel
      ? `No expenses recorded for "${activeTagLabel}".`
      : "No expenses recorded yet.";

  return (
    <div className="w-full space-y-4">
      {/* ── Segmented Control ── */}
      <div className="flex w-full bg-zinc-100/80 p-1 rounded-2xl gap-1 shadow-inner">
        {/* Revenue */}
        <button
          onClick={() => setActiveTab("INCOME")}
          className={`
            relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold
            transition-all duration-200 ease-in-out select-none
            ${
              activeTab === "INCOME"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60"
            }
          `}
        >
          <TrendingUp className="w-4 h-4 shrink-0" />
          Revenue
          {incomeCount > 0 && (
            <span
              className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === "INCOME"
                  ? "bg-emerald-500/40 text-white"
                  : "bg-zinc-200 text-zinc-600"
              }`}
            >
              {incomeCount}
            </span>
          )}
        </button>

        {/* Expenses */}
        <button
          onClick={() => setActiveTab("EXPENSE")}
          className={`
            relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold
            transition-all duration-200 ease-in-out select-none
            ${
              activeTab === "EXPENSE"
                ? "bg-red-500 text-white shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60"
            }
          `}
        >
          <TrendingDown className="w-4 h-4 shrink-0" />
          Expenses
          {expenseCount > 0 && (
            <span
              className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${
                activeTab === "EXPENSE"
                  ? "bg-red-400/40 text-white"
                  : "bg-zinc-200 text-zinc-600"
              }`}
            >
              {expenseCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Desktop Table ── */}
      <div className="hidden md:block overflow-x-auto rounded-md border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Date</TableHead>
              <TableHead className="whitespace-nowrap">Category</TableHead>
              <TableHead className="whitespace-nowrap">Payment</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Amount (EGP)
              </TableHead>
              <TableHead className="text-right whitespace-nowrap">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedTransactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-zinc-400"
                >
                  <div className="flex flex-col items-center gap-2">
                    {activeTab === "INCOME" ? (
                      <TrendingUp className="w-7 h-7 text-zinc-300" />
                    ) : (
                      <TrendingDown className="w-7 h-7 text-zinc-300" />
                    )}
                    <span className="text-sm font-medium">{emptyMessage}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              displayedTransactions.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.category}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {t.paymentMethod}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={
                        t.status === "RECEIVED"
                          ? "text-green-600 bg-green-50"
                          : "text-amber-600 bg-amber-50"
                      }
                    >
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium whitespace-nowrap">
                    {Number(t.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex justify-end gap-2">
                      {t.receiptUrl && (
                        <a
                          href={t.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Receipt
                        </a>
                      )}
                      <DeleteTransactionButton id={t.id} orgSlug={orgSlug} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Mobile Cards ── */}
      <div className="md:hidden space-y-3">
        {displayedTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 rounded-2xl border border-dashed bg-zinc-50 gap-3">
            {activeTab === "INCOME" ? (
              <TrendingUp className="w-8 h-8 text-zinc-300" />
            ) : (
              <TrendingDown className="w-8 h-8 text-zinc-300" />
            )}
            <p className="text-zinc-400 font-medium text-sm">{emptyMessage}</p>
          </div>
        ) : (
          displayedTransactions.map((t) => (
            <MobileTransactionCard
              key={t.id}
              transaction={t}
              orgSlug={orgSlug}
            />
          ))
        )}
      </div>
    </div>
  );
}

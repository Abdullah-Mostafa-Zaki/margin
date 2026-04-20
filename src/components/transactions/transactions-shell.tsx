"use client";

import { useState, useRef, useCallback, useMemo } from "react";
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
import { TransactionActions } from "@/components/transactions/transaction-actions";
import type { TransactionFormHandle, TransactionToEdit } from "@/components/transactions/transaction-form";

interface TagProp {
  id: string;
  name: string;
}

interface TransactionsShellProps {
  transactions: Transaction[];
  orgSlug: string;
  tags: TagProp[];
  activeTagLabel?: string;
  /** Slot for the DateRangePicker + TagFilter server-rendered controls */
  headerControls?: React.ReactNode;
}

export function TransactionsShell({
  transactions,
  orgSlug,
  tags,
  activeTagLabel,
  headerControls,
}: TransactionsShellProps) {
  const [activeTab, setActiveTab] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const formHandleRef = useRef<TransactionFormHandle | null>(null);

  const handleFormReady = useCallback((handle: TransactionFormHandle) => {
    formHandleRef.current = handle;
  }, []);

  const openEdit = useCallback((t: Transaction) => {
    const payload: TransactionToEdit = {
      id: t.id,
      amount: Number(t.amount),
      type: t.type as "INCOME" | "EXPENSE",
      category: t.category,
      paymentMethod: t.paymentMethod as "CASH" | "CARD" | "COD" | "INSTAPAY",
      date: t.date,
      notes: t.notes,
      status: t.status as "PENDING" | "RECEIVED",
    };
    formHandleRef.current?.openForEdit(payload);
  }, []);

  // Static category lists — mirrors the TransactionForm constants
  const EXPENSE_CATEGORIES = ["Raw Materials", "Manufacturing", "Packaging", "Logistics (Shipping)", "Ads", "Content Creation", "Other"];
  const INCOME_CATEGORIES  = ["Sales Revenue", "Pop-up / Bazaar Sales", "Wholesale / B2B", "Supplier Refund", "Other"];
  const availableCategories = activeTab === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // 3-step pipeline: type → category → sort
  const displayedTransactions = useMemo(() => {
    let filtered = transactions.filter((t) => t.type === activeTab);
    if (selectedCategory !== "All") {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }
    return [...filtered].sort((a, b) => {
      if (sortOrder === "newest") return new Date(b.date).getTime() - new Date(a.date).getTime();
      if (sortOrder === "oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
      if (sortOrder === "highest") return Number(b.amount) - Number(a.amount);
      if (sortOrder === "lowest") return Number(a.amount) - Number(b.amount);
      return 0;
    });
  }, [transactions, activeTab, selectedCategory, sortOrder]);

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
    <div className="space-y-8">
      {/* ── Page Header Row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-zinc-500">Manage your income and expenses.</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          {headerControls}
          <TransactionActions
            orgSlug={orgSlug}
            tags={tags}
            onFormReady={handleFormReady}
          />
        </div>
      </div>

      {/* ── Segmented Control ── */}
      <div className="flex w-full bg-zinc-100/80 p-1 rounded-2xl gap-1 shadow-inner"
        onClick={() => setSelectedCategory("All")}
      >
        {/* Revenue */}
        <button
          onClick={(e) => { e.stopPropagation(); setActiveTab("INCOME"); setSelectedCategory("All"); }}
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
          onClick={(e) => { e.stopPropagation(); setActiveTab("EXPENSE"); setSelectedCategory("All"); }}
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

      {/* ── Filter / Sort Bar ── */}
      <div className="flex flex-row gap-3 mb-4">
        {/* Category filter */}
        <div className="relative w-1/2 sm:w-64">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pr-9 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer truncate"
          >
            <option value="All">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {/* Chevron icon */}
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Sort order */}
        <div className="relative w-1/2 sm:w-48">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
            className="w-full appearance-none rounded-xl border border-zinc-200 bg-white px-4 py-2.5 pr-9 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Amount</option>
            <option value="lowest">Lowest Amount</option>
          </select>
          {/* Chevron icon */}
          <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
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
                <TableCell colSpan={6} className="h-32 text-center text-zinc-400">
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
                <TableRow
                  key={t.id}
                  className="cursor-pointer hover:bg-zinc-50 transition-colors"
                  onClick={() => openEdit(t)}
                >
                  <TableCell className="whitespace-nowrap">
                    {new Date(t.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{t.category}</TableCell>
                  <TableCell className="whitespace-nowrap">{t.paymentMethod}</TableCell>
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
                          onClick={(e) => e.stopPropagation()}
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
              onEdit={() => openEdit(t)}
            />
          ))
        )}
      </div>
    </div>
  );
}

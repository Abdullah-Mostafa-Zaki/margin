"use client";

import { useState, useTransition, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createTransaction, updateTransaction } from "@/actions/transactions.actions";
import { UploadButton } from "@/lib/uploadthing";
import { ChevronDown, ChevronRight, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

import { motion, AnimatePresence } from "framer-motion";

const EXPENSE_CATEGORIES = [
  "Raw Materials",
  "Manufacturing",
  "Packaging",
  "Logistics (Shipping)",
  "Ads",
  "Content Creation",
  "Other"
];

const INCOME_CATEGORIES = [
  "Sales Revenue",
  "Pop-up / Bazaar Sales",
  "Wholesale / B2B",
  "Supplier Refund",
  "Other"
];

const INCOME_PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "INSTAPAY", label: "Instapay" },
  { value: "COD", label: "Cash on Delivery (COD)" },
];

const EXPENSE_PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "INSTAPAY", label: "Instapay" },
];

const QUICK_TEMPLATES = [
  { label: "Meta Ads", type: "EXPENSE", category: "Ads" },
  { label: "Raw Materials", type: "EXPENSE", category: "Raw Materials" },
  { label: "Packaging", type: "EXPENSE", category: "Packaging" },
  { label: "Sales Revenue", type: "INCOME", category: "Sales Revenue" },
];

interface TagProp {
  id: string;
  name: string;
}

export interface TransactionDefaultValues {
  amount?: number;
  type?: "INCOME" | "EXPENSE";
  category?: string;
  paymentMethod?: "CASH" | "CARD" | "COD" | "INSTAPAY";
  date?: string;
  notes?: string;
}

export interface TransactionToEdit {
  id: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  paymentMethod: "CASH" | "CARD" | "COD" | "INSTAPAY";
  date: Date | string;
  notes?: string | null;
  status?: "PENDING" | "RECEIVED";
  fulfillmentStatus?: "UNFULFILLED" | "SHIPPED" | "DELIVERED" | "RETURNED";
}

export interface TransactionFormHandle {
  openWithDefaults: (defaults: TransactionDefaultValues) => void;
  openForEdit: (transaction: TransactionToEdit) => void;
}

const TransactionForm = forwardRef<TransactionFormHandle, { 
  orgSlug: string; 
  tags?: TagProp[];
  prefillData?: Partial<TransactionDefaultValues>;
  onSuccessCallback?: (data: any) => void;
  onCancelCallback?: () => void;
}>(
  function TransactionForm({ orgSlug, tags = [], prefillData, onSuccessCallback, onCancelCallback }, ref) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [category, setCategory] = useState("Raw Materials");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [statusOverride, setStatusOverride] = useState("");
  const [showStatusOverride, setShowStatusOverride] = useState(false);
  const [fulfillmentStatus, setFulfillmentStatus] = useState("UNFULFILLED");

  const [showTags, setShowTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  // Validation Assist — tracks which fields the AI left at their defaults
  const [unmentionedFields, setUnmentionedFields] = useState<string[]>([]);

  // Refs for native inputs that need imperative value setting
  const formRef = useRef<HTMLFormElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // Expose imperative handle so external components (MagicVoiceButton) can open the form with defaults
  const fillRefs = (amount?: number, date?: string, notes?: string | null) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (amount != null && amount > 0 && amountRef.current) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          setter?.call(amountRef.current, String(amount));
          amountRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (date && dateRef.current) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          setter?.call(dateRef.current, date);
          dateRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (notesRef.current) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          setter?.call(notesRef.current, notes ?? '');
          notesRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    });
  };

  useImperativeHandle(ref, () => ({
    openWithDefaults(defaults: TransactionDefaultValues) {
      if (defaults.type) setType(defaults.type);
      if (defaults.category) setCategory(defaults.category);
      if (defaults.paymentMethod) setPaymentMethod(defaults.paymentMethod);
      setEditingId(null);
      setStatusOverride("");
      setShowStatusOverride(false);
      setFulfillmentStatus("UNFULFILLED");
      setError(null);
      setIsOpen(true);
      fillRefs(defaults.amount, defaults.date, defaults.notes);
    },

    openForEdit(t: TransactionToEdit) {
      setEditingId(t.id);
      setType(t.type);
      setCategory(t.category);
      setPaymentMethod(t.paymentMethod);
      // Convert status override only if it differs from the auto value
      const autoStatus = t.paymentMethod === 'COD' ? 'PENDING' : 'RECEIVED';
      if (t.status && t.status !== autoStatus) {
        setStatusOverride(t.status);
        setShowStatusOverride(true);
      } else {
        setStatusOverride("");
        setShowStatusOverride(false);
      }
      setFulfillmentStatus(t.fulfillmentStatus || "UNFULFILLED");
      setReceiptUrl(null); // receipt editing not supported in edit mode
      setSelectedTags([]);
      setShowTags(false);
      setError(null);
      setIsOpen(true);
      const dateStr = typeof t.date === 'string'
        ? t.date.slice(0, 10)
        : new Date(t.date).toISOString().slice(0, 10);
      fillRefs(t.amount, dateStr, t.notes);
    },
  }));

  const autoStatus = paymentMethod === "COD" ? "PENDING" : "RECEIVED";
  const displayStatus = statusOverride || autoStatus;

  // form helpers for useEffect sync
  const selectedType = type;
  const activePaymentMethods = selectedType === "INCOME" ? INCOME_PAYMENT_METHODS : EXPENSE_PAYMENT_METHODS;

  useEffect(() => {
    if (selectedType === "EXPENSE" && paymentMethod === "COD") {
      setPaymentMethod("CASH");
    }
  }, [selectedType, paymentMethod]);

  // Handle prefill data from AI
  useEffect(() => {
    if (prefillData) {
      if (prefillData.type) setType(prefillData.type);
      if (prefillData.category) setCategory(prefillData.category);
      if (prefillData.paymentMethod) setPaymentMethod(prefillData.paymentMethod);
      setEditingId(null);
      setStatusOverride("");
      setShowStatusOverride(false);
      setFulfillmentStatus("UNFULFILLED");
      setError(null);
      setIsOpen(true);
      fillRefs(prefillData.amount, prefillData.date, prefillData.notes);

      // Validation Assist — flag only fields the AI left at their safe defaults
      const today = new Date().toLocaleDateString("en-CA");
      const flagged: string[] = [];
      // amount: only flag if AI returned 0 or missing
      if (!prefillData.amount || prefillData.amount <= 0) flagged.push("amount");
      // category: only flag if empty string (AI couldn't detect one)
      if (!prefillData.category || prefillData.category === "") flagged.push("category");
      // paymentMethod: flag if AI defaulted to CASH (most ambiguous default)
      if (!prefillData.paymentMethod || prefillData.paymentMethod === "CASH") flagged.push("paymentMethod");
      // notes: flag if empty — encourage user to add context
      if (!prefillData.notes || prefillData.notes.trim() === "") flagged.push("notes");
      // date: flag only if AI returned today (could be a fallback, not an explicit mention)
      if (!prefillData.date || prefillData.date === today) flagged.push("date");
      setUnmentionedFields(flagged);

      setTimeout(() => {
        if (formRef.current) formRef.current.reportValidity();
      }, 100);
    }
  }, [prefillData]);

  // Clean error when opening modal
  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    const formData = new FormData(e.currentTarget);

    formData.set("type", type);
    formData.set("category", category);
    formData.set("paymentMethod", paymentMethod);
    formData.set("status", displayStatus);
    formData.set("fulfillmentStatus", fulfillmentStatus);

    if (receiptUrl) {
      formData.append("receiptUrl", receiptUrl);
    }

    selectedTags.forEach((tagId) => {
      formData.append("tagIds", tagId);
    });

    // Debug: log exactly what we're sending to the server
    console.log("📝 Submitting Transaction:", Object.fromEntries(formData));

    setError(null);

    startTransition(async () => {
      try {
        if (editingId) {
          await updateTransaction(editingId, orgSlug, formData);
        } else {
          await createTransaction(orgSlug, formData);
        }

        // Close modal only AFTER server confirms success
        setIsOpen(false);

        // Reset React state
        setEditingId(null);
        setReceiptUrl(null);
        setType("EXPENSE");
        setCategory("Raw Materials");
        setPaymentMethod("CASH");
        setStatusOverride("");
        setShowStatusOverride(false);
        setFulfillmentStatus("UNFULFILLED");
        setSelectedTags([]);
        setShowTags(false);

        // Reset native input refs
        if (amountRef.current) amountRef.current.value = "";
        if (dateRef.current) dateRef.current.value = new Date().toISOString().split('T')[0];
        if (notesRef.current) notesRef.current.value = "";

        router.refresh();
        if (onSuccessCallback) {
          onSuccessCallback({
            amount: formData.get("amount"),
            category: formData.get("category"),
            type: formData.get("type"),
            paymentMethod: formData.get("paymentMethod"),
          });
        }
      } catch (err: any) {
        setError(err.message || "Failed to save transaction.");
      }
    });
  };

  const handleTagChange = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const applyTemplate = (templateType: string, templateCategory: string) => {
    setType(templateType as "EXPENSE" | "INCOME");
    setCategory(templateCategory);
  };

  const activeCategories = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open && onCancelCallback) {
        onCancelCallback();
      }
    }}>
      {/* Desktop Button */}
      <Button className="hidden md:flex bg-[#27A67A] hover:bg-[#27A67A]/90 text-white" onClick={() => setIsOpen(true)}>Add Transaction</Button>

      {/* Mobile FAB */}
      <button
        className="md:hidden flex items-center justify-center fixed right-6 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] h-14 w-14 rounded-full bg-[#27A67A] text-white hover:bg-[#27A67A]/90 shadow-lg active:scale-95 transition-all duration-200 z-50"
        onClick={() => setIsOpen(true)}
        aria-label="Add Transaction"
      >
        <Plus className="h-6 w-6" />
      </button>

      <DialogContent className="w-full md:max-w-2xl max-h-[100dvh] md:max-h-[85vh] min-h-[100dvh] md:min-h-0 md:h-auto rounded-none md:rounded-xl p-0 md:p-8 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {isOpen && (
            <motion.div
              key="modal-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
              className="flex flex-col flex-1 min-h-0 w-full h-full"
            >
              <DialogHeader className="px-4 pt-4 md:pt-0 md:px-0 shrink-0">
                <DialogTitle>{editingId ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
              </DialogHeader>

              {error && (
                <div className="flex items-center gap-2 p-3 mx-4 mt-2 text-sm font-medium text-red-800 rounded-lg bg-red-50 border border-red-200">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto overscroll-contain px-4 md:px-0 pt-4 pb-6 md:pr-2">

                  {/* Quick Templates */}
                  <div className="flex flex-wrap gap-2 pb-4 w-full">
                    {QUICK_TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyTemplate(tmpl.type, tmpl.category)}
                        className="flex items-center justify-center min-h-[44px] md:min-h-[32px] px-4 md:px-3 rounded-full border border-zinc-200 bg-white shadow-sm text-sm md:text-xs font-medium active:scale-95 transition-transform duration-75 text-zinc-700 shrink-0"
                      >
                        {tmpl.label}
                      </button>
                    ))}
                  </div>

                  {/* ── Responsive 2-column grid ───────────────────────────── */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

                    {/* Row 1 col 1 — Amount (full width on mobile, half on md) */}
                    <div className="col-span-1 md:col-span-1 space-y-2">
                      <label className={cn(
                        "text-sm font-semibold",
                        unmentionedFields.includes("amount") ? "text-amber-600" : "text-muted-foreground"
                      )}>Amount (EGP){unmentionedFields.includes("amount") && " · confirm"}</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl md:text-lg font-bold text-muted-foreground">EGP</span>
                        <input
                          ref={amountRef}
                          type="number"
                          name="amount"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          required
                          onChange={() => setUnmentionedFields(prev => prev.filter(f => f !== "amount"))}
                          className={cn(
                            "flex w-full rounded-xl border bg-background py-4 md:py-3 pl-14 md:pl-12 pr-4 text-3xl md:text-2xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 transition-shadow duration-200",
                            unmentionedFields.includes("amount")
                              ? "border-amber-400 ring-2 ring-amber-300 ring-offset-1"
                              : "border-neutral-300"
                          )}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Row 1 col 2 — Type toggle */}
                    <div className="col-span-1 md:col-span-1 space-y-2">
                      <label className="text-sm font-semibold text-muted-foreground">Type</label>
                      <div className="grid grid-cols-2 gap-2 h-[calc(100%-1.75rem)]">
                        <button type="button"
                          onClick={() => { setType("INCOME"); setCategory("Sales Revenue"); }}
                          className={cn(
                            "rounded-lg border-2 font-medium text-sm transition-colors py-3 md:py-2",
                            type === "INCOME"
                              ? "bg-green-50 border-green-500 text-green-700"
                              : "border-input text-muted-foreground hover:bg-muted"
                          )}
                        >
                          Income
                        </button>
                        <button type="button"
                          onClick={() => { setType("EXPENSE"); setCategory("Raw Materials"); }}
                          className={cn(
                            "rounded-lg border-2 font-medium text-sm transition-colors py-3 md:py-2",
                            type === "EXPENSE"
                              ? "bg-red-50 border-red-500 text-red-700"
                              : "border-input text-muted-foreground hover:bg-muted"
                          )}
                        >
                          Expense
                        </button>
                      </div>
                    </div>

                    {/* Row 2 col 1 — Category */}
                    <div className="col-span-1 md:col-span-1 space-y-2">
                      <label className={cn(
                        "text-sm font-semibold",
                        unmentionedFields.includes("category") ? "text-amber-600" : ""
                      )}>Category{unmentionedFields.includes("category") && " · confirm"}</label>
                      <Select
                        name="category"
                        value={category}
                        onValueChange={(val) => {
                          if (val) {
                            setCategory(val);
                            setUnmentionedFields(prev => prev.filter(f => f !== "category"));
                          }
                        }}
                        required
                      >
                        <SelectTrigger className={cn(
                          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-neutral-900 transition-shadow",
                          unmentionedFields.includes("category")
                            ? "border-amber-400 ring-2 ring-amber-300 ring-offset-1"
                            : "border-neutral-300"
                        )}>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {activeCategories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Row 2 col 2 — Payment Method */}
                    <div className="col-span-1 md:col-span-1 space-y-2">
                      <label className={cn(
                        "text-sm font-semibold",
                        unmentionedFields.includes("paymentMethod") ? "text-amber-600" : ""
                      )}>Payment Method{unmentionedFields.includes("paymentMethod") && " · confirm"}</label>
                      <Select
                        name="paymentMethod"
                        value={paymentMethod}
                        onValueChange={(val) => {
                          if (val) {
                            setPaymentMethod(val);
                            setUnmentionedFields(prev => prev.filter(f => f !== "paymentMethod"));
                          }
                        }}
                        required
                      >
                        <SelectTrigger className={cn(
                          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-neutral-900 transition-shadow",
                          unmentionedFields.includes("paymentMethod")
                            ? "border-amber-400 ring-2 ring-amber-300 ring-offset-1"
                            : "border-neutral-300"
                        )}>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {activePaymentMethods.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Row 3 col 1 — Date */}
                    <div className="col-span-1 md:col-span-1 space-y-2">
                      <label className={cn(
                        "text-sm font-semibold",
                        unmentionedFields.includes("date") ? "text-amber-600" : ""
                      )}>Date{unmentionedFields.includes("date") && " · confirm"}</label>
                      <input
                        ref={dateRef}
                        type="date"
                        name="date"
                        required
                        defaultValue={new Date().toISOString().split('T')[0]}
                        onChange={() => setUnmentionedFields(prev => prev.filter(f => f !== "date"))}
                        className={cn(
                          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 transition-shadow",
                          unmentionedFields.includes("date")
                            ? "border-amber-400 ring-2 ring-amber-300 ring-offset-1"
                            : "border-neutral-300"
                        )}
                      />
                    </div>

                    {/* Row 3 col 2 — Status */}
                    <div className="col-span-1 md:col-span-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold">Status</label>
                        <button
                          type="button"
                          onClick={() => setShowStatusOverride(!showStatusOverride)}
                          className="text-xs font-medium text-primary hover:underline hover:text-primary/90"
                        >
                          {showStatusOverride ? "Cancel Override" : "Override"}
                        </button>
                      </div>
                      {showStatusOverride ? (
                        <Select
                          name="statusOverride"
                          value={statusOverride}
                          onValueChange={(val) => { if (val) setStatusOverride(val); }}
                        >
                          <SelectTrigger className="flex h-10 w-full rounded-md border border-neutral-300 bg-background px-3 py-2 text-sm font-medium">
                            <SelectValue placeholder="Auto-set by Payment" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="RECEIVED">Received</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex h-10 w-full items-center rounded-md border border-neutral-200 bg-muted/50 px-3 py-2 text-sm text-muted-foreground font-medium">
                          Auto: {autoStatus}
                        </div>
                      )}
                    </div>

                    {/* Row 4 col 1 — Fulfillment */}
                    <div className="col-span-1 md:col-span-1 space-y-2">
                      <label className="text-sm font-semibold">Fulfillment Status</label>
                      <Select
                        name="fulfillmentStatus"
                        value={fulfillmentStatus}
                        onValueChange={(val) => { if (val) setFulfillmentStatus(val); }}
                      >
                        <SelectTrigger className="flex h-10 w-full rounded-md border border-neutral-300 bg-background px-3 py-2 text-sm font-medium">
                          <SelectValue placeholder="Fulfillment Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNFULFILLED">Unfulfilled</SelectItem>
                          <SelectItem value="SHIPPED">Shipped</SelectItem>
                          <SelectItem value="DELIVERED">Delivered</SelectItem>
                          <SelectItem value="RETURNED">Returned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Optional section — full width */}
                    <div className="col-span-1 md:col-span-2 bg-muted/30 rounded-lg p-4 space-y-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Optional</p>

                      {tags.length > 0 && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => setShowTags(!showTags)}
                            className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
                          >
                            <span className={selectedTags.length > 0 ? "font-medium text-primary" : "text-muted-foreground"}>
                              {selectedTags.length > 0 ? `● ${selectedTags.length} Drop${selectedTags.length > 1 ? 's' : ''} selected` : "+ Add to Drop"}
                            </span>
                            {showTags ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          {showTags && (
                            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto rounded-md border border-input p-2 bg-background mt-2">
                              {tags.map((tag) => (
                                <label key={tag.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted p-1 rounded-md">
                                  <input
                                    type="checkbox"
                                    checked={selectedTags.includes(tag.id)}
                                    onChange={() => handleTagChange(tag.id)}
                                    className="h-4 w-4 rounded border-primary text-primary focus:ring-primary"
                                  />
                                  <span className="truncate">{tag.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes — full width inside optional */}
                      <div className="space-y-2">
                        <label className={cn(
                          "text-sm font-semibold",
                          unmentionedFields.includes("notes") ? "text-amber-600" : "text-muted-foreground"
                        )}>Notes{unmentionedFields.includes("notes") && " · add context"}</label>
                        <textarea
                          ref={notesRef}
                          name="notes"
                          placeholder="E.g. Courier Name..."
                          onChange={() => setUnmentionedFields(prev => prev.filter(f => f !== "notes"))}
                          className={cn(
                            "flex min-h-[60px] w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 transition-shadow",
                            unmentionedFields.includes("notes")
                              ? "border-amber-400 ring-2 ring-amber-300 ring-offset-1"
                              : "border-neutral-300"
                          )}
                        />
                      </div>

                      {/* Receipt — full width inside optional */}
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-muted-foreground">Receipt</label>
                        {receiptUrl ? (
                          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 font-medium">
                            <span className="truncate">✓ Ready: {receiptUrl.split("/").pop()}</span>
                            <button
                              type="button"
                              onClick={() => setReceiptUrl(null)}
                              className="ml-auto shrink-0 text-xs text-green-600 hover:text-red-500 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <UploadButton
                            endpoint="imageUploader"
                            appearance={{
                              button:
                                "w-full h-10 rounded-md border border-neutral-300 bg-neutral-50 hover:bg-neutral-100 text-sm !font-bold !text-black transition-colors ut-uploading:opacity-60 ut-uploading:cursor-not-allowed",
                              allowedContent: "hidden",
                            }}
                            content={{
                              button({ ready }) {
                                return ready ? "📎 Attach Receipt" : "Loading...";
                              },
                            }}
                            onClientUploadComplete={(res) => {
                              if (res && res[0]) setReceiptUrl(res[0].url);
                            }}
                            onUploadError={(error: Error) => {
                              alert(`Upload error: ${error.message}`);
                            }}
                          />
                        )}
                      </div>
                    </div>

                  </div>{/* end grid */}
                </div>

                <div className="shrink-0 px-4 md:px-0 pt-3 md:pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-0 border-t md:border-t-0 border-zinc-100 bg-white md:bg-transparent">
                  <Button type="submit" className="w-full flex h-14 md:h-10 text-base md:text-sm font-semibold bg-[#27A67A] hover:bg-[#27A67A]/90 text-white" disabled={isPending}>
                    {isPending ? (editingId ? "Updating..." : "Saving...") : (editingId ? "Update Transaction" : "Save Transaction")}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
});

export default TransactionForm;

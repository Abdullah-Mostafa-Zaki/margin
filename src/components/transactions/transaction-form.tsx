"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createTransaction } from "@/actions/transactions.actions";
import { parseVoiceTransaction } from "@/actions/ai.actions";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { UploadButton } from "@/lib/uploadthing";
import { ChevronDown, ChevronRight, Plus, AlertCircle, Mic, Loader2 } from "lucide-react";

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

export default function TransactionForm({ orgSlug, tags = [] }: { orgSlug: string; tags?: TagProp[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const [type, setType] = useState<"EXPENSE" | "INCOME">("EXPENSE");
  const [category, setCategory] = useState("Raw Materials");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [statusOverride, setStatusOverride] = useState("");
  const [showStatusOverride, setShowStatusOverride] = useState(false);

  const [showTags, setShowTags] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  // ── Magic Fill (Voice-to-Transaction) ─────────────────────────────────────
  const { isRecording, base64Audio, mimeType, startRecording, stopRecording, error: micError } = useAudioRecorder();
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  // When recording stops and we have audio, send it to Gemini
  useEffect(() => {
    if (!base64Audio || !mimeType || isAiProcessing) return;

    setIsAiProcessing(true);
    setError(null);

    parseVoiceTransaction(base64Audio, mimeType)
      .then((result) => {
        // Auto-fill all form fields from AI response
        setType(result.type);
        setCategory(result.category);
        setPaymentMethod(result.paymentMethod);

        // Set native input values via refs + trigger React change
        if (amountRef.current) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          nativeInputValueSetter?.call(amountRef.current, String(result.amount));
          amountRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (dateRef.current) {
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          nativeInputValueSetter?.call(dateRef.current, result.date);
          dateRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (notesRef.current) {
          const nativeTextareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          nativeTextareaSetter?.call(notesRef.current, result.notes || '');
          notesRef.current.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })
      .catch((err: any) => {
        setError(err.message || "Voice processing failed. Please try again.");
      })
      .finally(() => {
        setIsAiProcessing(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base64Audio, mimeType]);

  const handleMicToggle = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

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

  // Clean error when opening modal
  useEffect(() => {
    if (isOpen) {
      setError(null);
      // Apple iOS Safari Body-Lock Method
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isPending) return;

    const formData = new FormData(e.currentTarget);

    formData.set("type", type);
    formData.set("category", category);
    formData.set("paymentMethod", paymentMethod);
    formData.set("status", displayStatus);

    if (receiptUrl) {
      formData.append("receiptUrl", receiptUrl);
    }

    selectedTags.forEach((tagId) => {
      formData.append("tagIds", tagId);
    });

    // Optimistic Modal Close
    setIsOpen(false);
    setError(null);

    startTransition(async () => {
      try {
        await createTransaction(orgSlug, formData);
        // Reset form on success
        setReceiptUrl(null);
        setType("EXPENSE");
        setCategory("Raw Materials");
        setPaymentMethod("CASH");
        setStatusOverride("");
        setShowStatusOverride(false);
        setSelectedTags([]);
        setShowTags(false);

        // This will sync the transaction list on the page
        router.refresh();
      } catch (err: any) {
        // Rollback state visually
        setIsOpen(true);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {/* Desktop Button */}
      <Button className="hidden md:flex" onClick={() => setIsOpen(true)}>Add Transaction</Button>

      {/* Mobile FAB */}
      <button
        className="md:hidden flex items-center justify-center fixed right-6 bottom-[calc(1.5rem+env(safe-area-inset-bottom))] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform duration-75 z-50"
        onClick={() => setIsOpen(true)}
        aria-label="Add Transaction"
      >
        <Plus className="h-6 w-6" />
      </button>

      <DialogContent className="w-full md:max-w-lg max-h-[100dvh] md:max-h-[85vh] min-h-[100dvh] md:min-h-0 md:h-auto rounded-none md:rounded-lg p-0 md:p-6 flex flex-col overflow-hidden">
        <DialogHeader className="px-4 pt-4 md:pt-0 md:px-0 shrink-0">
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 p-3 mx-4 mt-2 text-sm font-medium text-red-800 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* Scrollable body — px-4 keeps content inset from edges */}
          <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 px-4 md:px-0 pt-4 pb-6 md:pr-2">
            {/* Quick Templates (Scrollable Chips) */}
            <div className="flex flex-wrap gap-2 pb-2 w-full max-w-full">
              {QUICK_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => applyTemplate(tmpl.type, tmpl.category)}
                  className="flex items-center justify-center min-h-[44px] md:min-h-[32px] px-4 md:px-3 rounded-full border border-zinc-200 bg-white shadow-sm text-sm md:text-xs font-medium active:scale-95 transition-transform duration-75 text-zinc-700 max-w-full shrink-0"
                >
                  {tmpl.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium text-muted-foreground">Amount (EGP)</label>
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
                  className="flex w-full max-w-full rounded-xl border border-input bg-background py-4 md:py-3 pl-14 md:pl-12 pr-14 text-3xl md:text-2xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="0.00"
                />
                {/* Magic Fill Mic Button */}
                <button
                  type="button"
                  onClick={handleMicToggle}
                  disabled={isAiProcessing}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center h-10 w-10 rounded-full transition-all duration-200 ${
                    isAiProcessing
                      ? "bg-zinc-100 text-zinc-400 cursor-wait"
                      : isRecording
                        ? "bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 active:scale-95"
                  }`}
                  title={isRecording ? "Stop recording" : "Magic Fill — speak your transaction"}
                >
                  {isAiProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </button>
              </div>
              {(micError) && (
                <p className="text-xs text-red-500 mt-1">{micError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button type="button"
                onClick={() => {
                  setType("INCOME");
                  setCategory("Sales Revenue");
                }}
                className={`h-10 w-full max-w-full rounded-lg border-2 font-medium text-sm transition-colors ${type === "INCOME"
                    ? "bg-green-50 border-green-500 text-green-700"
                    : "border-input text-muted-foreground hover:bg-muted"
                  }`}
              >
                Income
              </button>
              <button type="button"
                onClick={() => {
                  setType("EXPENSE");
                  setCategory("Raw Materials");
                }}
                className={`h-10 w-full max-w-full rounded-lg border-2 font-medium text-sm transition-colors ${type === "EXPENSE"
                    ? "bg-red-50 border-red-500 text-red-700"
                    : "border-input text-muted-foreground hover:bg-muted"
                  }`}
              >
                Expense
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select
                  name="category"
                  value={category}
                  onValueChange={(val) => { if (val) setCategory(val); }}
                  required
                >
                  <SelectTrigger className="flex h-10 w-full max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Payment Method</label>
                <Select
                  name="paymentMethod"
                  value={paymentMethod}
                  onValueChange={(val) => { if (val) setPaymentMethod(val); }}
                  required
                >
                  <SelectTrigger className="flex h-10 w-full max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
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
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <input
                ref={dateRef}
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="flex h-10 w-full max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Status</label>
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
                  <SelectTrigger className="flex h-10 w-full max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <SelectValue placeholder="Auto-set by Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="RECEIVED">Received</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-10 w-full max-w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground font-medium">
                  Auto: {autoStatus}
                </div>
              )}
            </div>

            <div className="bg-muted/30 rounded-lg p-4 space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Optional</p>

              {tags.length > 0 && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowTags(!showTags)}
                    className="flex w-full max-w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <span className={selectedTags.length > 0 ? "font-medium text-primary" : "text-muted-foreground"}>
                      {selectedTags.length > 0 ? `● ${selectedTags.length} Drop${selectedTags.length > 1 ? 's' : ''} selected` : "+ Add to Drop"}
                    </span>
                    {showTags ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>

                  {showTags && (
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto rounded-md border border-input p-2 bg-background mt-2 w-full max-w-full">
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

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <textarea ref={notesRef} name="notes" placeholder="E.g. Courier Name..." className="flex min-h-[60px] w-full max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Receipt</label>
                {receiptUrl ? (
                  <div className="rounded-md border p-2 text-sm text-green-600 truncate border-green-200 bg-green-50">
                    Ready: {receiptUrl}
                  </div>
                ) : (
                  <div className="border border-input rounded-md p-1 bg-background">
                    <UploadButton
                      endpoint="imageUploader"
                      onClientUploadComplete={(res) => {
                        if (res && res[0]) {
                          setReceiptUrl(res[0].url);
                        }
                      }}
                      onUploadError={(error: Error) => {
                        alert(`ERROR! ${error.message}`);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 px-4 md:px-0 pt-3 md:pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-0 border-t md:border-t-0 border-zinc-100 bg-white md:bg-transparent">
            <Button type="submit" className="w-full flex h-14 md:h-10 text-base md:text-sm font-semibold" disabled={isPending}>
              {isPending ? "Saving..." : "Save Transaction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


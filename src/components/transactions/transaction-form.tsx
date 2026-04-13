"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { createTransaction } from "@/actions/transactions.actions";
import { UploadButton } from "@/lib/uploadthing";
import { ChevronDown, ChevronRight } from "lucide-react";

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

  const autoStatus = paymentMethod === "COD" ? "PENDING" : "RECEIVED";
  const displayStatus = statusOverride || autoStatus;

  const form = {
    watch: (field: string) => type,
    getValues: (field: string) => paymentMethod,
    setValue: (field: string, value: string) => setPaymentMethod(value),
  };

  const selectedType = form.watch("type");
  const activePaymentMethods = selectedType === "INCOME" ? INCOME_PAYMENT_METHODS : EXPENSE_PAYMENT_METHODS;

  useEffect(() => {
    if (selectedType === "EXPENSE" && form.getValues("paymentMethod") === "COD") {
      form.setValue("paymentMethod", "CASH");
    }
  }, [selectedType]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

    startTransition(async () => {
      try {
        await createTransaction(orgSlug, formData);
        setIsOpen(false);
        setReceiptUrl(null);
        setType("EXPENSE");
        setCategory("Raw Materials");
        setPaymentMethod("CASH");
        setStatusOverride("");
        setShowStatusOverride(false);
        setSelectedTags([]);
        setShowTags(false);
        router.refresh();
      } catch (err) {
        console.error(err);
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

  const activeCategories = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild><Button>Add Transaction</Button></DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto w-full">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          
          <div className="space-y-2 mb-6">
            <label className="text-sm font-medium text-muted-foreground">Amount (EGP)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground">EGP</span>
              <input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                required
                className="flex w-full rounded-xl border border-input bg-background py-4 pl-14 pr-4 text-3xl font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button type="button"
              onClick={() => {
                setType("INCOME");
                setCategory("Sales Revenue");
              }}
              className={`h-10 rounded-lg border-2 font-medium text-sm transition-colors ${
                type === "INCOME"
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
              className={`h-10 rounded-lg border-2 font-medium text-sm transition-colors ${
                type === "EXPENSE"
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
                <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
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
                <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
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
              type="date" 
              name="date" 
              required 
              defaultValue={new Date().toISOString().split('T')[0]} 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" 
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
                <SelectTrigger className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <SelectValue placeholder="Auto-set by Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="RECEIVED">Received</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground font-medium">
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

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <textarea name="notes" placeholder="E.g. Courier Name..." className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
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

          <Button type="submit" className="w-full flex h-10" disabled={isPending}>
            {isPending ? "Saving..." : "Save Transaction"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

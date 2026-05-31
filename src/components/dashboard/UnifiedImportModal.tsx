"use client";

import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScanLine, Sheet, Plus, ChevronLeft, Loader2, CheckCircle2, UploadCloud, AlertCircle, Trash2 } from "lucide-react";
import { useUploadThing } from "@/lib/uploadthing";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { usePostHog } from 'posthog-js/react';

type ImportStep = "SPLIT" | "AI_SCANNER" | "SMART_SPREADSHEET" | "REVIEW" | "SAVING" | "DONE";

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

export interface UnifiedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  paymentMethod: "CASH" | "CARD" | "INSTAPAY" | "COD";
  fulfillmentStatus?: "UNFULFILLED" | "SHIPPED" | "DELIVERED" | "RETURNED";
  confidence: "high" | "medium" | "low";
  confidenceNote?: string;
  imageUrl?: string;
}

export function UnifiedImportModal({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>("SPLIT");
  const [isUploading, setIsUploading] = useState(false);
  const [transactions, setTransactions] = useState<UnifiedTransaction[]>([]);
  const [importMethod, setImportMethod] = useState<"image" | "shopify" | "flexible">("flexible");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posthog = usePostHog();

  const { startUpload } = useUploadThing("receiptUploader", {
    onUploadBegin: () => {
      setIsUploading(true);
    },
    onClientUploadComplete: async (res) => {
      if (!res || res.length === 0) return;
      
      try {
        const urls = res.map((f) => f.ufsUrl);
        // Call the new Image Route Handler
        const response = await fetch(`/api/organizations/${orgSlug}/imports/analyze-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls })
        });
        
        if (!response.ok) throw new Error("Failed to analyze images");
        const data = await response.json();
        
        if (data.transactions && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
          setImportMethod("image");
          setStep("REVIEW");
        } else {
          toast.error("No transactions found.");
          setStep("SPLIT");
        }
      } catch (err: any) {
        toast.error(`Analysis failed: ${err.message}`);
        setStep("SPLIT");
      } finally {
        setIsUploading(false);
      }
    },
    onUploadError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    },
  });

  const handleOpenChange = (val: boolean) => {
    if (isUploading || step === "SAVING") return;
    setOpen(val);
    if (val) {
      posthog?.capture('import_started');
    }
    if (!val) {
      resetState();
    }
  };

  const resetState = () => {
    setStep("SPLIT");
    setTransactions([]);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      let rows: any[] = [];
      let headers: string[] = [];

      if (file.name.endsWith(".csv")) {
        const raw = await file.text();
        const result = Papa.parse(raw, { header: true, skipEmptyLines: true });
        rows = result.data;
        headers = result.meta.fields || [];
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(worksheet);
        if (rows.length > 0) {
          headers = Object.keys(rows[0] as object);
        }
      }

      const hLower = headers.map(h => h.toLowerCase());
      let routeTag = "flexible";
      
      if (hLower.includes("name") && hLower.includes("financial status") && hLower.includes("total")) {
        routeTag = "shopify";
      }

      const response = await fetch(`/api/organizations/${orgSlug}/imports/analyze-csv`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: routeTag, headers, rows })
      });

      if (!response.ok) throw new Error("Failed to process spreadsheet");
      const data = await response.json();

      if (data.transactions && Array.isArray(data.transactions)) {
        setTransactions(data.transactions);
        setImportMethod(routeTag as "shopify" | "flexible");
        setStep("REVIEW");
      } else {
        toast.error("No transactions found in file.");
        resetState();
      }
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
      resetState();
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteTransaction = (index: number) => {
    const newTx = [...transactions];
    newTx.splice(index, 1);
    setTransactions(newTx);
  };

  const handleBatchSave = async () => {
    setStep("SAVING");
    try {
      const response = await fetch(`/api/organizations/${orgSlug}/transactions/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions, method: importMethod })
      });
      
      if (!response.ok) throw new Error("Failed to save transactions");
      const data = await response.json();
      
      if (data.success) {
        toast.success(`Saved ${data.created} transactions successfully.`);
        setStep("DONE");
      } else {
        throw new Error(data.error || "Unknown error occurred.");
      }
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`);
      setStep("REVIEW");
    }
  };

  const totalCount = transactions.length;
  const totalIncome = transactions.filter(t => t.type === "INCOME").reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalExpense = transactions.filter(t => t.type === "EXPENSE").reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          Import Data
        </Button>
      </DialogTrigger>
      <DialogContent className="!w-[95vw] !max-w-[95vw] xl:!max-w-[1200px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        
        {step === "SPLIT" && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle>Import Data (Magic Box)</DialogTitle>
              <DialogDescription>Let our AI automatically sort your data into Revenue or Expenses.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col sm:flex-row gap-4 w-full">
              <Card className="flex-1 cursor-pointer hover:border-primary transition-colors" onClick={() => setStep("AI_SCANNER")}>
                <CardHeader>
                  <ScanLine className="w-8 h-8 text-blue-500 mb-2" />
                  <CardTitle>AI Scanner</CardTitle>
                  <CardDescription>Upload Instapay screenshots, receipts, or invoices.</CardDescription>
                </CardHeader>
              </Card>
              <Card className="flex-1 cursor-pointer hover:border-primary transition-colors" onClick={() => setStep("SMART_SPREADSHEET")}>
                <CardHeader>
                  <Sheet className="w-8 h-8 text-emerald-500 mb-2" />
                  <CardTitle>Smart Spreadsheet</CardTitle>
                  <CardDescription>Upload Shopify exports or any custom ledger.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        )}

        {step === "AI_SCANNER" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => resetState()} className="-ml-2" disabled={isUploading}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col">
                <DialogTitle>AI Scanner</DialogTitle>
                <DialogDescription>Drop up to 10 screenshots (JPG, PNG, WEBP, PDF).</DialogDescription>
              </div>
            </div>

            {isUploading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Uploading and analyzing images...</p>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg h-48 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary transition-colors"
                onClick={() => document.getElementById("receipt-file-input")?.click()}
              >
                <UploadCloud className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground">Up to 10 images, max 4MB each</p>
                <input
                  id="receipt-file-input"
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) {
                      setIsUploading(true);
                      try {
                        const res = await startUpload(files);
                        if (!res) setIsUploading(false);
                      } catch (err) {
                        setIsUploading(false);
                      }
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {step === "SMART_SPREADSHEET" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => resetState()} className="-ml-2" disabled={isUploading}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col">
                <DialogTitle>Smart Spreadsheet</DialogTitle>
                <DialogDescription>Upload your CSV or Excel ledger.</DialogDescription>
              </div>
            </div>

            {isUploading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing spreadsheet...</p>
              </div>
            ) : (
              <div
                className="border-2 border-dashed rounded-lg h-48 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Sheet className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to upload CSV/Excel</p>
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
              </div>
            )}
          </div>
        )}

        {step === "REVIEW" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-4">
                <div><span className="text-sm text-muted-foreground">Count:</span> <span className="font-medium">{totalCount}</span></div>
                <div><span className="text-sm text-muted-foreground">Total Income:</span> <span className="font-medium text-emerald-600">{totalIncome.toFixed(2)}</span></div>
                <div><span className="text-sm text-muted-foreground">Total Expense:</span> <span className="font-medium text-red-600">{totalExpense.toFixed(2)}</span></div>
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto w-full">
              <table className="w-full text-sm text-left hidden sm:table">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-2 py-3 font-medium">#</th>
                    <th className="px-2 py-3 font-medium">Date</th>
                    <th className="px-2 py-3 font-medium">Description</th>
                    <th className="px-2 py-3 font-medium">Amount</th>
                    <th className="px-2 py-3 font-medium">Type</th>
                    <th className="px-2 py-3 font-medium">Category</th>
                    <th className="px-1 py-3 font-medium text-center">Method</th>
                    <th className="px-2 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((t, i) => (
                    <tr key={i} className={`bg-card ${t.confidence === "low" ? "bg-red-50/50" : t.confidence === "medium" ? "bg-amber-50/50" : ""}`}>
                      <td className="px-2 py-3 text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {i + 1}
                          {t.confidence !== "high" && (
                            <div title={t.confidenceNote || "Review needed"} className="inline-flex">
                              <AlertCircle className={`w-4 h-4 ${t.confidence === "low" ? "text-red-500" : "text-amber-500"}`} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-3 w-[130px]">
                        <Input type="date" value={t.date || ""} className="px-2" onChange={(e) => {
                          const newTx = [...transactions];
                          newTx[i].date = e.target.value;
                          setTransactions(newTx);
                        }} />
                      </td>
                      <td className="px-2 py-3 min-w-[120px]">
                        <Input value={t.description || ""} className="px-2" onChange={(e) => {
                          const newTx = [...transactions];
                          newTx[i].description = e.target.value;
                          setTransactions(newTx);
                        }} />
                      </td>
                      <td className="px-2 py-3 w-[90px]">
                        <Input type="number" value={t.amount || ""} className="px-2 w-[80px]" onChange={(e) => {
                          const newTx = [...transactions];
                          newTx[i].amount = parseFloat(e.target.value) || 0;
                          setTransactions(newTx);
                        }} />
                      </td>
                      <td className="px-2 py-3 w-[100px]">
                        <Select value={t.type} onValueChange={(val: any) => {
                          const newTx = [...transactions];
                          newTx[i].type = val;
                          newTx[i].category = val === "INCOME" ? "Sales Revenue" : "Raw Materials";
                          setTransactions(newTx);
                        }}>
                          <SelectTrigger className={`w-[95px] h-8 px-2 ${t.type === "INCOME" ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-red-600 border-red-200 bg-red-50"}`}>
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INCOME">INCOME</SelectItem>
                            <SelectItem value="EXPENSE">EXPENSE</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-3 w-[140px]">
                        <Select value={t.category || ""} onValueChange={(val) => {
                          const newTx = [...transactions];
                          newTx[i].category = val || "";
                          setTransactions(newTx);
                        }}>
                          <SelectTrigger className="px-2">
                            <SelectValue placeholder="Category" />
                          </SelectTrigger>
                          <SelectContent>
                            {(t.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-3 w-[100px]">
                        <Select value={t.paymentMethod} onValueChange={(val: any) => {
                          const newTx = [...transactions];
                          newTx[i].paymentMethod = val;
                          setTransactions(newTx);
                        }}>
                          <SelectTrigger className="px-2">
                            <SelectValue placeholder="Method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="CASH">CASH</SelectItem>
                            <SelectItem value="CARD">CARD</SelectItem>
                            <SelectItem value="INSTAPAY">INSTAPAY</SelectItem>
                            <SelectItem value="COD">COD</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-3 w-[40px]">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(i)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards View (same fields) */}
            <div className="sm:hidden flex flex-col gap-6">
              {transactions.map((t, i) => (
                <div key={`mobile-${i}`} className={`flex flex-col gap-3 p-4 border rounded-md ${t.confidence === "low" ? "bg-red-50/50" : t.confidence === "medium" ? "bg-amber-50/50" : "bg-card"}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-bold flex items-center gap-2">
                      Transaction #{i + 1}
                      {t.confidence !== "high" && <AlertCircle className={`w-4 h-4 ${t.confidence === "low" ? "text-red-500" : "text-amber-500"}`} />}
                    </span>
                    <div className="flex items-center gap-2">
                      <Select value={t.type} onValueChange={(val: any) => {
                        const newTx = [...transactions];
                        newTx[i].type = val;
                        newTx[i].category = val === "INCOME" ? "Sales Revenue" : "Raw Materials";
                        setTransactions(newTx);
                      }}>
                        <SelectTrigger className={`w-[110px] h-8 ${t.type === "INCOME" ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-red-600 border-red-200 bg-red-50"}`}>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="INCOME">INCOME</SelectItem>
                          <SelectItem value="EXPENSE">EXPENSE</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTransaction(i)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Date</label>
                    <Input type="date" value={t.date || ""} onChange={(e) => {
                      const newTx = [...transactions];
                      newTx[i].date = e.target.value;
                      setTransactions(newTx);
                    }} />
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Description</label>
                    <Input value={t.description || ""} onChange={(e) => {
                      const newTx = [...transactions];
                      newTx[i].description = e.target.value;
                      setTransactions(newTx);
                    }} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Amount</label>
                    <Input type="number" value={t.amount || ""} onChange={(e) => {
                      const newTx = [...transactions];
                      newTx[i].amount = parseFloat(e.target.value) || 0;
                      setTransactions(newTx);
                    }} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Category</label>
                    <Select value={t.category || ""} onValueChange={(val) => {
                      const newTx = [...transactions];
                      newTx[i].category = val || "";
                      setTransactions(newTx);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                      <SelectContent>
                        {(t.type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Method</label>
                    <Select value={t.paymentMethod} onValueChange={(val: any) => {
                      const newTx = [...transactions];
                      newTx[i].paymentMethod = val;
                      setTransactions(newTx);
                    }}>
                      <SelectTrigger><SelectValue placeholder="Method" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">CASH</SelectItem>
                        <SelectItem value="CARD">CARD</SelectItem>
                        <SelectItem value="INSTAPAY">INSTAPAY</SelectItem>
                        <SelectItem value="COD">COD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full mt-4 sm:justify-end">
              <Button variant="outline" onClick={() => resetState()}>Cancel</Button>
              <Button onClick={handleBatchSave}>Confirm & Import</Button>
            </div>
          </div>
        )}

        {step === "SAVING" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Saving transactions...</p>
          </div>
        )}

        {step === "DONE" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="text-lg font-medium text-emerald-700">Data imported successfully</p>
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

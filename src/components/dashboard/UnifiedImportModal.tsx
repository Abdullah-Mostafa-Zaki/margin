"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ScanLine, Sheet, Plus, ChevronLeft, Loader2, CheckCircle2, UploadCloud } from "lucide-react";
import { CSVUploader } from "@/components/dashboard/CSVUploader";
import { useUploadThing } from "@/lib/uploadthing";
import { parseReceiptFromImage } from "@/actions/ai.actions";
import type { ParsedReceipt } from "@/actions/ai.actions";
import { bulkSaveReceipts } from "@/actions/csvImport";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type ImportStep = "SPLIT" | "REVENUE" | "EXPENSES" | "RECEIPT_SCANNER";
type ReceiptStep = "DROPZONE" | "PROCESSING" | "REVIEW" | "SAVING" | "DONE";

export function UnifiedImportModal({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>("SPLIT");
  const [isUploading, setIsUploading] = useState(false);

  // Scanner flow state
  const [receiptStep, setReceiptStep] = useState<ReceiptStep>("DROPZONE");
  const [receipts, setReceipts] = useState<ParsedReceipt[]>([]);

  const { startUpload, isUploading: isUTUploading } = useUploadThing("receiptUploader", {
    onUploadBegin: () => {
      setIsUploading(true);
    },
    onClientUploadComplete: async (res) => {
      console.log("upload complete", res);
      if (!res || res.length === 0) return;
      setReceiptStep("PROCESSING");
      
      // 1000ms "breather" delay to ensure CDN propagation
      await new Promise(resolve => setTimeout(resolve, 1000));

      const urls = res.map((f) => f.ufsUrl);
      const results = await Promise.allSettled(urls.map((url) => parseReceiptFromImage(url)));
      const fulfilledReceipts: ParsedReceipt[] = [];
      let failedCount = 0;
      for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
          fulfilledReceipts.push(result.value);
        } else {
          failedCount++;
          console.error("Failed to parse receipt:", result);
        }
      }
      setReceipts(fulfilledReceipts);
      if (failedCount > 0) {
        toast.warning(`Successfully extracted ${fulfilledReceipts.length} receipts. ${failedCount} could not be parsed due to image quality.`);
      } else {
        toast.success(`Successfully extracted ${fulfilledReceipts.length} receipts.`);
      }
      setReceiptStep("REVIEW");
    },
    onUploadError: (error: Error) => {
      console.error("Upload failed", error);
      toast.error(`Upload failed: ${error.message}`);
      setIsUploading(false);
    },
  });

  const handleOpenChange = (val: boolean) => {
    if (isUploading) return;
    setOpen(val);
    if (!val) {
      setStep("SPLIT");
      setReceiptStep("DROPZONE");
      setReceipts([]);
    }
  };

  const handleSetStep = (newStep: ImportStep) => {
    if (step === "RECEIPT_SCANNER" && newStep !== "RECEIPT_SCANNER") {
      setReceiptStep("DROPZONE");
      setReceipts([]);
    }
    setStep(newStep);
  };

  // Trigger bulk save on SAVING phase
  useEffect(() => {
    if (receiptStep === "SAVING") {
      let isMounted = true;
      bulkSaveReceipts(organizationId, receipts)
        .then((res) => {
          if (!isMounted) return;
          setIsUploading(false);
          if (res.success) {
            toast.success(`Saved ${res.saved} expenses successfully.`);
            setReceiptStep("DONE");
          } else {
            toast.error("Failed to save some receipts.");
            setReceiptStep("REVIEW");
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          console.error("Bulk save error:", err);
          setIsUploading(false);
          toast.error("An error occurred while saving.");
          setReceiptStep("REVIEW");
        });
      return () => {
        isMounted = false;
      };
    }
  }, [receiptStep, organizationId, receipts]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          Import Data
        </Button>
      </DialogTrigger>
      <DialogContent className={receiptStep === "REVIEW" || receiptStep === "SAVING" ? "max-w-4xl" : "max-w-2xl"}>
        {step === "SPLIT" && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle>Import Data</DialogTitle>
              <DialogDescription>Select a data type to get started.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSetStep("REVENUE")}>
                <CardHeader>
                  <TrendingUp className="w-8 h-8 text-emerald-500 mb-2" />
                  <CardTitle>Revenue</CardTitle>
                  <CardDescription>Import Shopify orders via CSV.</CardDescription>
                </CardHeader>
              </Card>
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSetStep("EXPENSES")}>
                <CardHeader>
                  <TrendingDown className="w-8 h-8 text-red-500 mb-2" />
                  <CardTitle>Expenses</CardTitle>
                  <CardDescription>Log costs, receipts, and invoices.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        )}
        
        {step === "REVENUE" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => handleSetStep("SPLIT")} className="-ml-2">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col">
                <DialogTitle>Import Revenue</DialogTitle>
                <DialogDescription>Upload your Shopify orders CSV file.</DialogDescription>
              </div>
            </div>
            <div className="py-4 flex justify-center">
              <CSVUploader organizationId={organizationId} onLoadingChange={setIsUploading} />
            </div>
          </div>
        )}
        
        {step === "EXPENSES" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => handleSetStep("SPLIT")} className="-ml-2">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col">
                <DialogTitle>Import Expenses</DialogTitle>
                <DialogDescription>Choose how to log your costs.</DialogDescription>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSetStep("RECEIPT_SCANNER")}>
                <CardHeader>
                  <ScanLine className="w-8 h-8 text-blue-500 mb-2" />
                  <CardTitle>AI Receipt Scanner</CardTitle>
                  <CardDescription>Scan Instapay and WhatsApp receipts.</CardDescription>
                </CardHeader>
              </Card>
              <Card className="opacity-50 cursor-not-allowed pointer-events-none relative">
                <Badge variant="secondary" className="absolute top-2 right-2">Coming Soon</Badge>
                <CardHeader>
                  <Sheet className="w-8 h-8 text-zinc-500 mb-2" />
                  <CardTitle>Flexible CSV / Excel</CardTitle>
                  <CardDescription>Upload a master expense sheet.</CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        )}

        {step === "RECEIPT_SCANNER" && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => handleSetStep("EXPENSES")} className="-ml-2">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col">
                <DialogTitle>AI Receipt Scanner</DialogTitle>
                <DialogDescription>Drop up to 10 screenshots to extract expense data.</DialogDescription>
              </div>
            </div>

            {receiptStep === "DROPZONE" && (
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
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) startUpload(files);
                  }}
                />
              </div>
            )}

            {receiptStep === "PROCESSING" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyzing receipts with AI...</p>
              </div>
            )}

            {receiptStep === "REVIEW" && (
              <div className="space-y-4">
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 font-medium">#</th>
                        <th className="px-4 py-3 font-medium">Image</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium">Merchant</th>
                        <th className="px-4 py-3 font-medium">Amount</th>
                        <th className="px-4 py-3 font-medium min-w-[150px]">Category</th>
                        <th className="px-4 py-3 font-medium">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {receipts.map((receipt, index) => (
                        <tr key={index} className="bg-card">
                          <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                          <td className="px-4 py-3">
                            <img src={receipt.imageUrl} alt="receipt" className="w-10 h-10 object-cover rounded" />
                          </td>
                          <td className="px-4 py-3 min-w-[140px]">
                            <Input 
                              type="date"
                              defaultValue={receipt.date || ""}
                              onChange={(e) => {
                                const newReceipts = [...receipts];
                                newReceipts[index].date = e.target.value;
                                setReceipts(newReceipts);
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 min-w-[150px]">
                            <Input 
                              defaultValue={receipt.merchant || ""}
                              onChange={(e) => {
                                const newReceipts = [...receipts];
                                newReceipts[index].merchant = e.target.value;
                                setReceipts(newReceipts);
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 min-w-[100px]">
                            <Input 
                              type="number"
                              defaultValue={receipt.amount || ""}
                              onChange={(e) => {
                                const newReceipts = [...receipts];
                                newReceipts[index].amount = parseFloat(e.target.value) || null;
                                setReceipts(newReceipts);
                              }}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Select 
                              defaultValue={receipt.category || "Other"}
                              onValueChange={(val) => {
                                const newReceipts = [...receipts];
                                newReceipts[index].category = val;
                                setReceipts(newReceipts);
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Ads">Ads</SelectItem>
                                <SelectItem value="Materials">Materials</SelectItem>
                                <SelectItem value="Shipping">Shipping</SelectItem>
                                <SelectItem value="Salary">Salary</SelectItem>
                                <SelectItem value="Software">Software</SelectItem>
                                <SelectItem value="Operations">Operations</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3 min-w-[150px]">
                            <Input 
                              defaultValue={receipt.notes || ""}
                              onChange={(e) => {
                                const newReceipts = [...receipts];
                                newReceipts[index].notes = e.target.value;
                                setReceipts(newReceipts);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => {
                    setReceiptStep("DROPZONE");
                    setReceipts([]);
                    setIsUploading(false);
                  }}>
                    Cancel
                  </Button>
                  <Button onClick={() => setReceiptStep("SAVING")}>
                    Approve & Log
                  </Button>
                </div>
              </div>
            )}

            {receiptStep === "SAVING" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Saving expenses...</p>
              </div>
            )}

            {receiptStep === "DONE" && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <p className="text-lg font-medium text-emerald-700">Expenses logged successfully</p>
                <Button onClick={() => handleOpenChange(false)}>
                  Done
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

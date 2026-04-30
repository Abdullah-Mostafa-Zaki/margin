"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, ScanLine, Sheet, Plus, ChevronLeft } from "lucide-react";
import { CSVUploader } from "@/components/dashboard/CSVUploader";

type ImportStep = "SPLIT" | "REVENUE" | "EXPENSES" | "RECEIPT_SCANNER";

export function UnifiedImportModal({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>("SPLIT");
  const [isUploading, setIsUploading] = useState(false);

  const handleOpenChange = (val: boolean) => {
    if (isUploading) return;
    setOpen(val);
    if (!val) setStep("SPLIT");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Plus className="w-4 h-4" />
          Import Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        {step === "SPLIT" && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle>Import Data</DialogTitle>
              <DialogDescription>Select a data type to get started.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStep("REVENUE")}>
                <CardHeader>
                  <TrendingUp className="w-8 h-8 text-emerald-500 mb-2" />
                  <CardTitle>Revenue</CardTitle>
                  <CardDescription>Import Shopify orders via CSV.</CardDescription>
                </CardHeader>
              </Card>
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStep("EXPENSES")}>
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
              <Button variant="ghost" size="icon" onClick={() => setStep("SPLIT")} className="-ml-2">
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
              <Button variant="ghost" size="icon" onClick={() => setStep("SPLIT")} className="-ml-2">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col">
                <DialogTitle>Import Expenses</DialogTitle>
                <DialogDescription>Choose how to log your costs.</DialogDescription>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setStep("RECEIPT_SCANNER")}>
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
              <Button variant="ghost" size="icon" onClick={() => setStep("EXPENSES")} className="-ml-2">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex flex-col">
                <DialogTitle>AI Receipt Scanner</DialogTitle>
                <DialogDescription>Drop up to 10 screenshots to extract expense data.</DialogDescription>
              </div>
            </div>
            <div className="border-2 border-dashed rounded-lg h-48 flex items-center justify-center text-muted-foreground text-sm">
              Dropzone coming soon — Step 3
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

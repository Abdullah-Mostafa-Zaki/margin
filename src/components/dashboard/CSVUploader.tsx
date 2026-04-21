"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import { groupShopifyRows } from "@/lib/utils/shopifyCsvGrouper";
import { bulkImportTransactions } from "@/actions/csvImport";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CSVUploaderProps {
  orgId: string;
}

export function CSVUploader({ orgId }: CSVUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      // Step 1: Parse
      const rawData = await new Promise<unknown[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error),
        });
      });

      // Step 2: Transform
      const grouped = groupShopifyRows(rawData as Record<string, string>[]);

      // Step 3: Chunk
      const CHUNK_SIZE = 100;
      const chunks = [];
      for (let i = 0; i < grouped.length; i += CHUNK_SIZE) {
        chunks.push(grouped.slice(i, i + CHUNK_SIZE));
      }

      // Step 4: Sequential Loop
      let totalCreated = 0;
      let totalSkipped = 0;
      let totalFailed = 0;

      for (const chunk of chunks) {
        try {
          const result = await bulkImportTransactions(orgId, chunk);
          
          if (!result.success) {
            // Zod validation failure - format zod errors
            let msg = "Validation failed: ";
            if (result.errors) {
              const e = result.errors;
              if (e.formErrors && e.formErrors.length > 0) msg += e.formErrors.join(", ");
              if (e.fieldErrors) {
                const fields = Object.keys(e.fieldErrors);
                if (fields.length > 0) msg += fields.join(", ") + " are invalid.";
              }
            }
            toast.error("Validation Error", {
              description: msg,
            });
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
          }

          totalCreated += result.created || 0;
          totalSkipped += result.skipped || 0;
          totalFailed += result.failed || 0;
        } catch (err) {
          toast.error("Network Error", {
            description: "Import failed. Please try again.",
          });
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      }

      toast.success("Import Complete", {
        description: `Imported ${totalCreated} orders — ${totalSkipped} duplicates skipped, ${totalFailed} failed.`,
      });
      
    } catch (err) {
      toast.error("Error", {
        description: "Failed to parse CSV file.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        type="file"
        accept=".csv"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <div onClick={(e) => e.stopPropagation()}>
        <Button
          variant="outline"
          onClick={() => {
            console.log("CSV Uploader Clicked");
            fileInputRef.current?.click();
          }}
          disabled={isUploading}
          className="gap-2 shrink-0 border-zinc-300"
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-[#27A67A]" /> : <Upload className="w-4 h-4 text-zinc-500" />}
          {isUploading ? "Importing..." : "Import Shopify CSV"}
        </Button>
      </div>
    </>
  );
}

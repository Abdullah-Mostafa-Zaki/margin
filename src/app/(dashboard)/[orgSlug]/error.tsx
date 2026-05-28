"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Server Component Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center space-y-4">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-zinc-900">Unable to load dashboard</h2>
      <p className="text-zinc-500 max-w-md">
        We encountered an unexpected error while loading your ledger data. This may be due to a network timeout or a large dataset.
      </p>
      <Button 
        onClick={() => reset()}
        className="mt-4 bg-[#27A67A] hover:bg-[#27A67A]/90 text-white"
      >
        Try again
      </Button>
    </div>
  );
}

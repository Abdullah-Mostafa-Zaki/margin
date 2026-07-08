"use client";

import { useState, useTransition } from "react";
import { updateOrganizationCourierFee } from "@/actions/organization.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function EditCourierFeeForm({ orgId, initialFee }: { orgId: string; initialFee: number }) {
  const [fee, setFee] = useState(initialFee.toString());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSave = () => {
    const parsedFee = Number(fee);
    if (isNaN(parsedFee) || parsedFee < 0 || parsedFee === initialFee) return;

    startTransition(async () => {
      try {
        await updateOrganizationCourierFee(orgId, parsedFee);
        router.refresh();
      } catch (error) {
        console.error("Failed to update shipping price:", error);
        alert("Failed to update shipping price");
      }
    });
  };

  const parsedFee = Number(fee);
  const isValid = !isNaN(parsedFee) && parsedFee >= 0;
  const isChanged = parsedFee !== initialFee;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Average Shipping Price (EGP)</label>
      <p className="text-xs text-zinc-500 -mt-1 mb-2">This is auto-deducted from incoming Shopify orders as a logistics expense.</p>
      <div className="flex flex-wrap gap-2 w-full">
        <Input
          type="number"
          min="0"
          value={fee}
          onChange={(e) => setFee(e.target.value)}
          disabled={isPending}
          className="flex-1 min-w-0 w-full"
        />
        <Button onClick={handleSave} disabled={isPending || !isChanged || !isValid}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </div>
  );
}

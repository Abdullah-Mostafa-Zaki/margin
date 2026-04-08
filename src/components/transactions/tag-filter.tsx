"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

export function TagFilter({ tags }: { tags: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentTagId = searchParams.get("tag") || "all";

  // Force exactly what text should display, bypassing Radix UI's internal matching
  const displayLabel = currentTagId === "all"
    ? "All Drops"
    : tags?.find((t) => t.id === currentTagId)?.name || "Unknown Drop";

  const handleValueChange = (value: string | null) => {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("tag");
    } else {
      params.set("tag", value);
    }
    
    // Prevents the UI from freezing and triggers the spinner
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <Select value={currentTagId} onValueChange={handleValueChange} disabled={isPending}>
      <SelectTrigger className="w-[180px]">
        {isPending ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Filtering...</span>
          </div>
        ) : (
          <SelectValue>{displayLabel}</SelectValue>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Drops</SelectItem>
        {tags?.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            {tag.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

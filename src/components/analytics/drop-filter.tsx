"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DropFilterProps {
  tags: { id: string; name: string }[];
  currentTagId?: string;
}

export function DropFilter({ tags, currentTagId }: DropFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handleValueChange = (value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (!value || value === "all") {
      params.delete("tagId");
    } else {
      params.set("tagId", value);
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative w-full">
        <Select value={currentTagId || "all"} onValueChange={handleValueChange}>
          <SelectTrigger className="!h-11 !py-0 !px-3 !pr-9 !rounded-xl w-full appearance-none border border-zinc-200 bg-white text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer truncate">
            <SelectValue placeholder="All Drops">
              {currentTagId && currentTagId !== "all"
                ? tags.find((t) => t.id === currentTagId)?.name
                : "All Drops"}
            </SelectValue>
          </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Drops</SelectItem>
          {tags.map((tag) => (
            <SelectItem key={tag.id} value={tag.id}>
              {tag.name}
            </SelectItem>
          ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

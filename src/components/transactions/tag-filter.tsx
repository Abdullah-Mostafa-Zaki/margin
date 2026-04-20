"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Loader2 } from "lucide-react";

const SELECT_CLS =
  "h-11 w-full appearance-none rounded-xl border border-zinc-200 bg-white px-3 pr-9 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer truncate";

const CHEVRON = (
  <svg
    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
);

export function TagFilter({ tags }: { tags: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentTagId = searchParams.get("tag") || "all";

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("tag");
    } else {
      params.set("tag", value);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="relative w-full" style={{ opacity: isPending ? 0.6 : 1 }}>
      {isPending ? (
        <div className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 flex items-center gap-2 text-sm text-zinc-400 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>Filtering…</span>
        </div>
      ) : (
        <>
          <select
            value={currentTagId}
            onChange={(e) => handleChange(e.target.value)}
            disabled={isPending}
            className={SELECT_CLS}
          >
            <option value="all">All Drops</option>
            {tags?.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          {CHEVRON}
        </>
      )}
    </div>
  );
}

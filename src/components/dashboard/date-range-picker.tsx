"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";

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

export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentRange = searchParams.get("range");
  const currentFrom  = searchParams.get("from");
  const currentTo    = searchParams.get("to");

  const [customFrom, setCustomFrom] = useState(currentFrom || "");
  const [customTo,   setCustomTo]   = useState(currentTo   || "");
  // Controls whether the custom date row is visible (local UI state)
  const [showCustom, setShowCustom] = useState(
    !!(currentFrom && currentTo)
  );

  // Derive the <select> value from URL state
  const selectValue =
    currentFrom && currentTo ? "custom" :
    currentRange             ? currentRange :
    "all";

  const handleChange = (value: string) => {
    if (value === "custom") {
      // Reveal the custom date inputs immediately; navigate only on Apply
      setShowCustom(true);
      return;
    }

    // Preset selected — hide custom row and push URL
    setShowCustom(false);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    params.delete("range");

    if (value !== "all") {
      params.set("range", value);
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleCustomApply = () => {
    if (!customFrom || !customTo) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.set("from", customFrom);
    params.set("to", customTo);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col gap-2 w-full" style={{ opacity: isPending ? 0.6 : 1 }}>
      <div className="relative w-full">
        <select
          value={showCustom ? "custom" : selectValue}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isPending}
          className={SELECT_CLS}
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="365d">Last 365 Days</option>
          <option value="all">All Time</option>
          <option value="custom">Custom Range</option>
        </select>
        {CHEVRON}
      </div>

      {showCustom && (
        <div className="flex flex-row items-center gap-2 w-full mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <span className="text-zinc-400 text-xs font-medium shrink-0">→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="flex-1 h-9 rounded-lg border border-zinc-200 bg-white px-3 text-xs text-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <button
            type="button"
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo || isPending}
            className="h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40 shrink-0 hover:bg-emerald-700 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

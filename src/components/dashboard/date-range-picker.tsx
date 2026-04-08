"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";

export function DateRangePicker() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentRange = searchParams.get("range");
  const currentFrom = searchParams.get("from");
  const currentTo = searchParams.get("to");

  const [showCustom, setShowCustom] = useState(!!(currentFrom && currentTo));
  const [customFrom, setCustomFrom] = useState(currentFrom || "");
  const [customTo, setCustomTo] = useState(currentTo || "");

  const handlePreset = (range: string | null) => {
    setShowCustom(false);
    const params = new URLSearchParams(searchParams.toString());
    
    params.delete("from");
    params.delete("to");

    if (range) {
      params.set("range", range);
    } else {
      params.delete("range");
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

  const isActive = (rangeVal: string | null) => {
    if (showCustom) return false;
    if (!rangeVal && !currentRange && !currentFrom) return true;
    return currentRange === rangeVal;
  };

  const btnClass = (active: boolean) => 
    `h-9 text-xs font-medium px-4 rounded-md transition-colors ${
      active 
        ? "bg-primary text-primary-foreground shadow" 
        : "bg-background text-muted-foreground border border-input hover:bg-muted"
    }`;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center" style={{ opacity: isPending ? 0.5 : 1 }}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => handlePreset("7d")} className={btnClass(isActive("7d"))} disabled={isPending}>
          Last 7 Days
        </button>
        <button type="button" onClick={() => handlePreset("30d")} className={btnClass(isActive("30d"))} disabled={isPending}>
          Last 30 Days
        </button>
        <button type="button" onClick={() => handlePreset("365d")} className={btnClass(isActive("365d"))} disabled={isPending}>
          Last 365 Days
        </button>
        <button type="button" onClick={() => handlePreset(null)} className={btnClass(isActive(null))} disabled={isPending}>
          All Time
        </button>
        <button type="button" onClick={() => setShowCustom(true)} className={btnClass(showCustom)} disabled={isPending}>
          Custom
        </button>
      </div>

      {showCustom && (
        <div className="flex items-center gap-2 mt-2 sm:mt-0 animate-in fade-in slide-in-from-left-2">
          <input 
            type="date" 
            value={customFrom} 
            onChange={e => setCustomFrom(e.target.value)} 
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          />
          <span className="text-muted-foreground text-xs font-medium">to</span>
          <input 
            type="date" 
            value={customTo} 
            onChange={e => setCustomTo(e.target.value)} 
            className="h-9 rounded-md border border-input bg-background px-3 text-xs"
          />
          <button 
            type="button"
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo || isPending}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 shadow"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

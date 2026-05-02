"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

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

  const [date, setDate] = useState<DateRange | undefined>({
    from: currentFrom ? new Date(currentFrom) : undefined,
    to: currentTo ? new Date(currentTo) : undefined,
  });
  // Controls whether the custom date row is visible (local UI state)
  const [showCustom, setShowCustom] = useState(
    !!(currentFrom && currentTo)
  );

  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 640px)");
    setIsDesktop(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

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
    if (!date?.from || !date?.to) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.set("from", format(date.from, "yyyy-MM-dd"));
    params.set("to", format(date.to, "yyyy-MM-dd"));
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full mt-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {isDesktop ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9 text-xs",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date?.from ? (
                    date.to ? (
                      <>
                        {format(date.from, "LLL dd, y")} -{" "}
                        {format(date.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(date.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={setDate}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          ) : (
            <div className="w-full bg-white rounded-xl border shadow-sm overflow-hidden flex justify-center p-2">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={1}
              />
            </div>
          )}
          <button
            type="button"
            onClick={handleCustomApply}
            disabled={!date?.from || !date?.to || isPending}
            className="h-9 w-full sm:w-auto px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold disabled:opacity-40 shrink-0 hover:bg-emerald-700 transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

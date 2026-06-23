import { DropSummary } from "@/app/actions/getDrops";
import { FadeIn } from "@/components/ui/fade-in";
import Link from "next/link";
import { Clock, PlayCircle } from "lucide-react";

interface ActiveDropsStripProps {
  drops: DropSummary[];
  orgSlug: string;
}

export function ActiveDropsStrip({ drops, orgSlug }: ActiveDropsStripProps) {
  // Only show LIVE and UPCOMING drops in the strip, max 5
  const activeDrops = drops.filter(d => d.computedStatus !== "ENDED").slice(0, 5);

  if (activeDrops.length === 0) return null;

  return (
    <div className="mb-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {activeDrops.map((drop, i) => {
        const isLive = drop.computedStatus === "LIVE";
        return (
          <FadeIn key={drop.id} delay={0.1 + i * 0.1} className="shrink-0">
            <Link href={`/${orgSlug}/tags/${drop.id}`}>
              <div className={`flex items-center whitespace-nowrap gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all duration-300 hover:shadow-md ${
                isLive ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100' : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}>
                {isLive ? <PlayCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                <span>{drop.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                  isLive ? 'bg-emerald-200/50' : 'bg-amber-200/50'
                }`}>
                  {isLive ? 'LIVE' : 'UPCOMING'}
                </span>
                {drop.daysRemaining !== null && (
                  <span className="text-xs opacity-75 font-normal">{drop.daysRemaining}d left</span>
                )}
                {drop.daysUntilStart !== null && (
                  <span className="text-xs opacity-75 font-normal">starts in {drop.daysUntilStart}d</span>
                )}
              </div>
            </Link>
          </FadeIn>
        );
      })}
    </div>
  );
}

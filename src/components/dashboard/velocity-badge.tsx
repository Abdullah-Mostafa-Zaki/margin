import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

export function VelocityBadge({ 
  delta, 
  invert = false,
  subtitleText = "vs prev period"
}: { 
  delta: number | null, 
  invert?: boolean,
  subtitleText?: string 
}) {
  if (delta === null || delta === 0 || isNaN(delta)) {
    return (
      <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600 mt-2">
        <Minus className="h-3 w-3" />
        <span>—</span>
      </div>
    );
  }

  const isPositive = delta > 0;
  const isGood = invert ? !isPositive : isPositive;
  
  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold mt-2 ${isGood ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      <span>{Math.abs(delta).toFixed(1)}% {subtitleText}</span>
    </div>
  );
}

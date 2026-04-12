import { DashboardInsights } from "@/app/actions/getDashboardInsights";

interface TruthBannerProps {
  insights: DashboardInsights;
}

/**
 * Server component that surfaces a plain-English financial snapshot — 
 * no corporate fluff, just the truth.
 */
export default function TruthBanner({ insights }: TruthBannerProps) {
  const { mainText, actionText, escrowText, colorClass } = insights;

  return (
    <div
      className={`rounded-xl border p-5 ${colorClass}`}
      role="region"
      aria-label="Margin Reality Check"
    >
      {/* ── Label ────────────────────────────────────────────────────────── */}
      <p className="text-xs font-bold tracking-wide uppercase opacity-70 mb-2">
        Margin Reality Check
      </p>

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <p className="text-lg font-semibold leading-snug">{mainText}</p>
      <p className="mt-1 text-base opacity-90">{actionText}</p>

      {/* ── Escrow Badge ─────────────────────────────────────────────────── */}
      {escrowText && (
        <p className="mt-3 pt-3 border-t border-current/10 text-sm font-medium">
          {escrowText}
        </p>
      )}
    </div>
  );
}

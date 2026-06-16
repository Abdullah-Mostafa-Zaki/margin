"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";

interface UpgradeOverlayProps {
  children: React.ReactNode;
  message?: string;
  /** If true, the overlay is active (feature is locked). If false, children render normally. */
  locked: boolean;
}

export function UpgradeOverlay({
  children,
  message = "Upgrade your plan to unlock this feature",
  locked,
}: UpgradeOverlayProps) {
  const params = useParams();
  const orgSlug = params?.orgSlug as string | undefined;
  const pricingHref = orgSlug ? `/${orgSlug}/pricing` : "/pricing";

  if (!locked) return <>{children}</>;

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred ghost content */}
      <div
        className="pointer-events-none select-none"
        style={{ filter: "blur(6px)" }}
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Glass overlay with CTA */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/60 backdrop-blur-sm rounded-xl">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-zinc-900/5 border border-zinc-200">
          <Lock className="w-5 h-5 text-zinc-500" />
        </div>
        <p className="text-sm font-medium text-zinc-700 text-center max-w-[260px] leading-snug">
          {message}
        </p>
        <Link
          href={pricingHref}
          className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 transition-colors"
        >
          Upgrade Plan
        </Link>
      </div>
    </div>
  );
}

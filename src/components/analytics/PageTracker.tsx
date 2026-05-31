"use client";

import { useEffect } from "react";
import { usePostHog } from "posthog-js/react";

export function PageTracker({ feature }: { feature: string }) {
  const posthog = usePostHog();

  useEffect(() => {
    if (posthog) {
      posthog.capture("feature_visited", { feature });
    }
  }, [posthog, feature]);

  return null;
}

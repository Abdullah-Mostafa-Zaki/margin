"use client";

import posthog from 'posthog-js';
import { PostHogProvider as CSPostHogProvider } from 'posthog-js/react';
import { useEffect } from 'react';
import type { Session } from 'next-auth';

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  console.log('PostHog initialized', process.env.NEXT_PUBLIC_POSTHOG_KEY);
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: 'https://eu.posthog.com',
    capture_pageview: false, // We handle pageviews manually if needed or leave default on
  });
}

export function PostHogProvider({ children, session }: { children: React.ReactNode, session: Session | null }) {

  useEffect(() => {
    if (session?.user?.email) {
      posthog.identify(session.user.email, {
        email: session.user.email,
        name: session.user.name,
      });
    } else if (session === null) {
      posthog.reset();
    }
  }, [session]);

  return <CSPostHogProvider client={posthog}>{children}</CSPostHogProvider>;
}

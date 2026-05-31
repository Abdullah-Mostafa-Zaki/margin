import { PostHog } from 'posthog-node';

export const posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY || '', {
  host: 'https://eu.posthog.com',
  flushAt: 1, // Flush immediately
  flushInterval: 0
});

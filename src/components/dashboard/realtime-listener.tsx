'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';

export default function RealtimeListener({
  orgSlug,
  organizationId,
}: {
  orgSlug: string;
  organizationId: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`transactions-${orgSlug}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Transaction',
          filter: `organizationId=eq.${organizationId}`,
        },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, orgSlug, router]);

  return null;
}

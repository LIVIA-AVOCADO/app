'use client';

/**
 * Hook: useChannelRealtime
 *
 * Escuta mudanças na tabela channels via Supabase Realtime.
 * Atualiza connection_status e identification_number em tempo real
 * quando o webhook da Evolution ou o polling de fallback altera o DB.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ChannelStatus {
  connectionStatus: string;
  phoneNumber: string;
}

const MAX_RETRIES      = 8;
const BASE_DELAY_MS    = 1000;
const STABILITY_WINDOW = 5000;

export function useChannelRealtime(
  channelId: string | null,
  initial: ChannelStatus
) {
  const [status, setStatus] = useState<ChannelStatus>(initial);

  const supabaseRef      = useRef(createClient());
  const realtimeRef      = useRef<RealtimeChannel | null>(null);
  const retryCountRef    = useRef(0);
  const retryTimerRef    = useRef<NodeJS.Timeout | null>(null);
  const stabilityRef     = useRef<NodeJS.Timeout | null>(null);

  const subscribe = useCallback(() => {
    if (!channelId) return;

    const supabase = supabaseRef.current;

    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (realtimeRef.current)   { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }

    const ch = supabase
      .channel(`channel-status-${channelId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'channels', filter: `id=eq.${channelId}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: { new: any }) => {
          const row = payload.new as { connection_status?: string; identification_number?: string };
          setStatus((prev) => ({
            connectionStatus: row.connection_status ?? prev.connectionStatus,
            phoneNumber:      row.identification_number ?? prev.phoneNumber,
          }));
        }
      )
      .subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          if (stabilityRef.current) clearTimeout(stabilityRef.current);
          stabilityRef.current = setTimeout(() => { retryCountRef.current = 0; }, STABILITY_WINDOW);
          return;
        }
        if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
          if (stabilityRef.current) { clearTimeout(stabilityRef.current); stabilityRef.current = null; }
          if (retryCountRef.current < MAX_RETRIES) {
            const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCountRef.current), 30000);
            retryTimerRef.current = setTimeout(() => { retryCountRef.current++; subscribe(); }, delay);
          }
        }
      });

    realtimeRef.current = ch;
  }, [channelId]);

  useEffect(() => {
    if (!channelId) return;
    const supabase = supabaseRef.current;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (!cancelled) subscribe();
    });

    return () => {
      cancelled = true;
      if (retryTimerRef.current)  { clearTimeout(retryTimerRef.current);  retryTimerRef.current = null; }
      if (stabilityRef.current)   { clearTimeout(stabilityRef.current);   stabilityRef.current = null; }
      if (realtimeRef.current)    { supabase.removeChannel(realtimeRef.current); realtimeRef.current = null; }
      if (retryTimerRef.current)  { clearTimeout(retryTimerRef.current);  retryTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  return { status, setStatus };
}

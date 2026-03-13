'use client';

/**
 * Hook: useRealtimeConversation
 *
 * Subscreve em tempo real às mudanças de estado de uma conversa
 * (status, ia_active, etc)
 *
 * Inclui reconexão automática com backoff exponencial.
 * clearTimeout APÓS removeChannel: removeChannel dispara CLOSED sincronamente,
 * que agenda retry espúrio — deve ser limpo imediatamente depois.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Conversation } from '@/types/database-helpers';

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

export function useRealtimeConversation(initialConversation: Conversation) {
  const [conversation, setConversation] = useState<Conversation>(initialConversation);

  const supabaseRef = useRef(createClient());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setConversation(initialConversation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversation.id]);

  const handleUpdate = useCallback((payload: { new: Conversation }) => {
    setConversation(payload.new);
  }, []);

  const subscribe = useCallback(() => {
    const supabase = supabaseRef.current;

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // removeChannel dispara CLOSED sincronamente → limpar retry espúrio
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const channel = supabase
      .channel(`conversation:${initialConversation.id}:state`)
      .on<Conversation>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${initialConversation.id}`,
        },
        handleUpdate
      )
      .subscribe((status, err) => {
        // #region agent log
        fetch('http://127.0.0.1:7468/ingest/9ca4e704-5ea1-4ecc-bdf2-ebf3d33f0fe1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7c8c6a'},body:JSON.stringify({sessionId:'7c8c6a',location:'use-realtime-conversation.ts:status',message:`conv-state status=${status}`,data:{status,err:err?.message||null,convId:initialConversation.id,channels:supabaseRef.current.getChannels().length},timestamp:Date.now(),hypothesisId:'H1,H2'})}).catch(()=>{});
        // #endregion
        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (err) {
            console.error('[useRealtimeConversation] channel error:', err);
          }

          if (retryCountRef.current < MAX_RETRIES) {
            const delay = Math.min(BASE_DELAY * Math.pow(2, retryCountRef.current), 30000);
            retryTimeoutRef.current = setTimeout(() => {
              retryCountRef.current++;
              subscribe();
            }, delay);
          }
        }
      });

    channelRef.current = channel;
  }, [initialConversation.id, handleUpdate]);

  useEffect(() => {
    subscribe();
    const supabase = supabaseRef.current;

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // removeChannel dispara CLOSED sincronamente → limpar retry espúrio
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversation.id]);

  return { conversation };
}

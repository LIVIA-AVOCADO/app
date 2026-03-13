'use client';

/**
 * Hook: useRealtimeConversation
 *
 * Subscreve em tempo real às mudanças de estado de uma conversa
 * (status, ia_active, etc)
 *
 * Inclui reconexão automática com backoff exponencial
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Conversation } from '@/types/database-helpers';

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

export function useRealtimeConversation(initialConversation: Conversation) {
  const [conversation, setConversation] = useState<Conversation>(initialConversation);

  // Instância única do Supabase — nunca recriada
  const supabaseRef = useRef(createClient());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset conversation when it changes
  useEffect(() => {
    setConversation(initialConversation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversation.id]);

  // Handler for conversation updates
  const handleUpdate = useCallback((payload: { new: Conversation }) => {
    setConversation(payload.new);
  }, []);

  // Subscribe with retry logic
  const subscribe = useCallback(() => {
    const supabase = supabaseRef.current;

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
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
      // Cleanup on unmount
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversation.id]);

  return { conversation };
}

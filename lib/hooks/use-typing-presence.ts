'use client';

/**
 * Hook: useTypingPresence
 *
 * Gerencia o indicador de digitação via Supabase Realtime Presence.
 *
 * - broadcastTyping(): chamado pelo MessageInput a cada keystroke
 * - isRemoteTyping: true quando a outra parte está digitando
 * - Para automaticamente após TYPING_TIMEOUT ms sem nova chamada
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

const TYPING_TIMEOUT = 3000; // ms sem keystroke para parar de exibir

export function useTypingPresence(conversationId: string) {
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);

  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const stopTypingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;

    const supabaseInstance = supabase;
    supabaseInstance.auth.getSession().then(({ data }) => {
      if (cancelled) return;

      const userId = data.session?.user.id ?? null;
      currentUserIdRef.current = userId;

      const channel = supabase.channel(`typing:${conversationId}`, {
        config: { presence: { key: userId ?? 'anonymous' } },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          if (cancelled) return;
          const state = channel.presenceState<{ typing: boolean }>();
          const remoteTyping = Object.entries(state).some(
            ([key, presences]) =>
              key !== (userId ?? 'anonymous') &&
              presences.some((p) => p.typing === true)
          );
          setIsRemoteTyping(remoteTyping);
        })
        .subscribe();

      channelRef.current = channel;
    });

    return () => {
      cancelled = true;
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      if (channelRef.current) {
        supabaseInstance.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId]);

  const broadcastTyping = useCallback(() => {
    const channel = channelRef.current;
    if (!channel) return;

    // Envia presença de "digitando"
    channel.track({ typing: true });

    // Agenda parar de digitar após timeout de inatividade
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(() => {
      channel.track({ typing: false });
    }, TYPING_TIMEOUT);
  }, []);

  return { isRemoteTyping, broadcastTyping };
}

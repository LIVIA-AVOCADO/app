'use client';

/**
 * Hook: useRealtimeConversations
 *
 * Canal leve para mudanças do livechat, otimizado para o Supabase Realtime:
 * - Apenas 1 subscription (event: '*' em conversations)
 * - Mensagens e conversation_tags NÃO são escutadas aqui para reduzir volume
 * - Quando last_message_at muda, busca-se a última mensagem via query
 * - Tags são atualizadas quando a conversa é selecionada ou via page refresh
 *
 * Design decisions:
 * - 1 subscription (não 4+) → menos carga no Supabase Realtime (crítico no free plan)
 * - Retry exponencial com estabilidade: retryCount só reseta após
 *   STABILITY_WINDOW_MS de conexão estável
 * - clearTimeout APÓS removeChannel: removeChannel dispara CLOSED sincronamente,
 *   que agenda retry espúrio — deve ser limpo imediatamente depois
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type {
  ConversationWithContact,
  ConversationWithContactLocalPatch,
  ConversationTagWithTag,
} from '@/types/livechat';
import type { Conversation } from '@/types/database-helpers';
import { invalidateMessagesCache } from './use-messages-cache';

const MAX_RETRIES = 10;
const BASE_DELAY = 1000;
const SORT_DEBOUNCE_MS = 100;
const STABILITY_WINDOW_MS = 5000;

export function useRealtimeConversations(
  tenantId: string,
  initialConversations: ConversationWithContact[]
) {
  const [conversations, setConversations] = useState<ConversationWithContact[]>(
    () => sortByLastMessage(initialConversations)
  );

  const supabaseRef = useRef(createClient());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stabilityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);
  const hasInitialDataRef = useRef(false);

  const tenantIdRef = useRef(tenantId);
  useEffect(() => {
    tenantIdRef.current = tenantId;
  }, [tenantId]);

  const debouncedSort = useDebouncedCallback(() => {
    setConversations((prev) => sortByLastMessage([...prev]));
  }, SORT_DEBOUNCE_MS);

  useEffect(() => {
    if (!hasInitialDataRef.current) {
      // Primeira carga: inicializa o estado completo
      setConversations(sortByLastMessage(initialConversations));
      hasInitialDataRef.current = true;
      return;
    }

    // Após router.refresh(), mescla dados do servidor (ex: conversation_tags atualizados)
    // sem sobrescrever mudanças feitas pelo Realtime (last_message_at, status, etc.)
    setConversations((prev) => {
      const serverMap = new Map(initialConversations.map((c) => [c.id, c]));
      const merged = prev.map((existing) => {
        const fromServer = serverMap.get(existing.id);
        if (!fromServer) return existing;
        // Mantém last_message_at e lastMessage do estado local (Realtime é mais recente)
        // mas atualiza campos que só chegam via server refresh (ex: conversation_tags)
        return {
          ...fromServer,
          lastMessage: existing.lastMessage ?? fromServer.lastMessage,
          last_message_at: existing.last_message_at ?? fromServer.last_message_at,
        };
      });
      // Adiciona novas conversas que vieram do servidor mas não estão no estado local
      const existingIds = new Set(prev.map((c) => c.id));
      const newFromServer = initialConversations.filter((c) => !existingIds.has(c.id));
      return sortByLastMessage([...merged, ...newFromServer]);
    });
  }, [initialConversations]);

  // ============================================================
  // Helpers assíncronos
  // ============================================================

  const fetchLatestMessage = useCallback(async (conversationId: string) => {
    const { data } = await supabaseRef.current
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }, []);

  const fetchFullConversation = useCallback(async (conversationId: string): Promise<ConversationWithContact | null> => {
    const { data, error } = await supabaseRef.current
      .from('conversations')
      .select(`
        *,
        contacts!inner(*),
        conversation_tags(
          tag:tags(id, tag_name, tag_type, color, is_category, order_index)
        )
      `)
      .eq('id', conversationId)
      .single();

    if (error || !data) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataAny = data as any;
    const tags = (dataAny.conversation_tags || []) as unknown as ConversationTagWithTag[];
    const category = (tags
      .map((ct) => ct.tag)
      .filter((tag) => tag && tag.is_category)
      .sort((a, b) => (a?.order_index || 0) - (b?.order_index || 0))[0] || null) as ConversationWithContact['category'];

    const lastMsg = await fetchLatestMessage(conversationId);

    return {
      ...data,
      contact: dataAny.contacts as unknown as ConversationWithContact['contact'],
      lastMessage: lastMsg,
      conversation_tags: tags,
      category,
    } as ConversationWithContact;
  }, [fetchLatestMessage]);

  // ============================================================
  // Handler único para todos os eventos de conversations
  // ============================================================

  const handleConversationChange = useCallback(async (
    payload: RealtimePostgresChangesPayload<Conversation>
  ) => {
    if (payload.eventType === 'DELETE') {
      const oldId = (payload.old as { id?: string })?.id;
      if (oldId) {
        setConversations((prev) => prev.filter((c) => c.id !== oldId));
      }
      return;
    }

    const conv = payload.new as Conversation;
    if (!conv || conv.tenant_id !== tenantIdRef.current) return;

    if (payload.eventType === 'INSERT') {
      const fullConv = await fetchFullConversation(conv.id);
      if (!fullConv) return;
      setConversations((prev) => {
        if (prev.some((c) => c.id === fullConv.id)) return prev;
        return sortByLastMessage([fullConv, ...prev]);
      });
      return;
    }

    // --- UPDATE ---
    if (conv.status === 'closed') {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === conv.id);
        if (index === -1) return prev;
        const existing = prev[index];
        if (!existing) return prev;
        const result = [...prev];
        result[index] = { ...existing, ...conv, contact: existing.contact, lastMessage: existing.lastMessage, conversation_tags: existing.conversation_tags, category: existing.category };
        return result;
      });
      return;
    }

    const latestMessage = conv.last_message_at
      ? await fetchLatestMessage(conv.id)
      : null;

    let wasFound = false;
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conv.id);
      if (index === -1) { wasFound = false; return prev; }

      wasFound = true;
      const existing = prev[index];
      if (!existing) return prev;

      const lastMessageChanged = existing.last_message_at !== conv.last_message_at;

      // Invalida cache apenas quando chegou uma nova mensagem (last_message_at mudou)
      if (lastMessageChanged && conv.last_message_at) {
        invalidateMessagesCache(conv.id);
      }

      const updated: ConversationWithContact = {
        ...existing,
        ...conv,
        contact: existing.contact,
        lastMessage: latestMessage || existing.lastMessage,
        conversation_tags: existing.conversation_tags,
        category: existing.category,
      };

      if (lastMessageChanged && index !== 0) {
        return [updated, ...prev.filter((_, i) => i !== index)];
      }

      const result = [...prev];
      result[index] = updated;
      return result;
    });

    if (!wasFound) {
      const fullConv = await fetchFullConversation(conv.id);
      if (fullConv) {
        setConversations((prev) => {
          if (prev.some((c) => c.id === fullConv.id)) return prev;
          return sortByLastMessage([fullConv, ...prev]);
        });
      }
      return;
    }

    debouncedSort();
  }, [debouncedSort, fetchLatestMessage, fetchFullConversation]);

  // ============================================================
  // 1 único canal, 1 única subscription
  // ============================================================
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
      .channel(`livechat-${tenantId}`, {
        config: { broadcast: { self: false } },
      })
      .on<Conversation>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        handleConversationChange
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
          stabilityTimerRef.current = setTimeout(() => {
            retryCountRef.current = 0;
          }, STABILITY_WINDOW_MS);
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isSubscribedRef.current = false;
          if (stabilityTimerRef.current) {
            clearTimeout(stabilityTimerRef.current);
            stabilityTimerRef.current = null;
          }

          if (err) {
            console.error('[useRealtimeConversations] channel error:', err);
          }

          if (retryCountRef.current < MAX_RETRIES) {
            const delay = Math.min(BASE_DELAY * Math.pow(2, retryCountRef.current), 30000);
            retryTimeoutRef.current = setTimeout(() => {
              retryCountRef.current++;
              subscribe();
            }, delay);
          } else {
            console.error('[useRealtimeConversations] max retries reached, giving up');
          }
        }
      });

    channelRef.current = channel;
  }, [tenantId, handleConversationChange]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;

    // Wait for auth session to be loaded before subscribing.
    // createBrowserClient (@supabase/ssr) loads tokens from cookies async;
    // subscribing before auth is ready causes Realtime to connect without
    // a valid JWT, making RLS silently filter all events.
    supabase.auth.getSession().then(() => {
      if (!cancelled) subscribe();
    });

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      // removeChannel dispara CLOSED sincronamente → limpar retry espúrio
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      isSubscribedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const updateConversation = useCallback((conversationId: string, updates: Partial<ConversationWithContact>) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversationId);
      if (index === -1) {
        return prev;
      }
      const existing = prev[index];
      if (!existing) return prev;
      const result = [...prev];
      result[index] = { ...existing, ...updates };
      return result;
    });
  }, []);

  /** Atualiza todas as conversas do mesmo contato (ex.: is_muted, ia_active em lote). */
  const patchAllConversationsForContact = useCallback(
    (contactId: string, updates: ConversationWithContactLocalPatch) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.contact.id !== contactId) return c;
          const { contact: contactUpd, ...convUpd } = updates;
          return {
            ...c,
            ...convUpd,
            contact: contactUpd ? { ...c.contact, ...contactUpd } : c.contact,
          };
        })
      );
    },
    []
  );

  return { conversations, updateConversation, patchAllConversationsForContact };
}

function sortByLastMessage(convs: ConversationWithContact[]): ConversationWithContact[] {
  return [...convs].sort((a, b) => {
    const timeA = a.lastMessage?.timestamp || a.last_message_at || a.created_at;
    const timeB = b.lastMessage?.timestamp || b.last_message_at || b.created_at;
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });
}

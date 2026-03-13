'use client';

/**
 * Hook: useRealtimeConversations
 *
 * Canal leve para mudanças do livechat, otimizado para o Supabase Realtime:
 * - Apenas 1 subscription (event: '*' em conversations filtrado por tenant_id)
 * - Mensagens e conversation_tags NÃO são escutadas aqui para reduzir volume
 * - Quando last_message_at muda, busca-se a última mensagem via query
 * - Tags são atualizadas quando a conversa é selecionada ou via page refresh
 *
 * Design decisions:
 * - 1 subscription (não 4+) → menos carga no Supabase Realtime (crítico no free plan)
 * - filter server-side por tenant_id → Supabase envia apenas eventos deste tenant
 * - Retry exponencial com estabilidade: retryCount só reseta após
 *   STABILITY_WINDOW_MS de conexão estável
 * - clearTimeout APÓS removeChannel: removeChannel dispara CLOSED sincronamente,
 *   que agenda retry espúrio — deve ser limpo imediatamente depois
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { ConversationWithContact, ConversationTagWithTag } from '@/types/livechat';
import type { Conversation } from '@/types/database-helpers';

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

  // #region agent log
  useEffect(() => {
    const sb = createClient();
    const testCh = sb.channel('effect-test-' + Math.random().toString(36).slice(2, 8))
      .on(
        'postgres_changes' as 'system',
        { event: '*', schema: 'public', table: 'conversations' } as Record<string, string>,
        (payload: unknown) => {
          const p = payload as Record<string, unknown>;
          console.log('[RT-DBG] EFFECT-TEST-EVENT!', p?.eventType);
        }
      )
      .subscribe((status: string) => {
        console.log('[RT-DBG] EFFECT-TEST-STATUS', status);
      });
    return () => { sb.removeChannel(testCh); };
  }, []);
  // #endregion
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
    if (!isSubscribedRef.current || !hasInitialDataRef.current) {
      setConversations(sortByLastMessage(initialConversations));
      hasInitialDataRef.current = true;
    }
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
          tag:tags(id, tag_name, color, is_category, order_index)
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
    // #region agent log
    try {
    const _evId = payload.eventType === 'DELETE' ? (payload.old as {id?:string})?.id : (payload.new as Conversation)?.id;
    console.log('[RT-DBG] event', {eventType: payload.eventType, convId: _evId?.slice(0,8), tenantId: (payload.new as Conversation)?.tenant_id?.slice(0,8)});
    // #endregion
    // --- DELETE ---
    if (payload.eventType === 'DELETE') {
      const oldId = (payload.old as { id?: string })?.id;
      if (oldId) {
        setConversations((prev) => prev.filter((c) => c.id !== oldId));
      }
      return;
    }

    const conv = payload.new as Conversation;
    if (!conv || conv.tenant_id !== tenantIdRef.current) return;

    // --- INSERT ---
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

      const updated: ConversationWithContact = {
        ...existing,
        ...conv,
        contact: existing.contact,
        lastMessage: latestMessage || existing.lastMessage,
        conversation_tags: existing.conversation_tags,
        category: existing.category,
      };

      const lastMessageChanged = existing.last_message_at !== conv.last_message_at;
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
    // #region agent log
    } catch (handlerErr: unknown) {
      console.error('[RT-DBG] HANDLER ERROR', handlerErr);
    }
    // #endregion
  }, [debouncedSort, fetchLatestMessage, fetchFullConversation]);

  // ============================================================
  // 1 único canal, 1 única subscription (com filtro server-side)
  // ============================================================
  const subscribe = useCallback(() => {
    const supabase = supabaseRef.current;

    // #region agent log
    console.log('[RT-DBG] subscribe()', {tenantId, channels: supabase.getChannels().length, retryCount: retryCountRef.current});
    if (typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__dbg_sb = supabase;
      console.log('[RT-DBG] supabase client exposed as window.__dbg_sb');
    }
    supabase.auth.getSession().then(({data}) => {
      const uid = data?.session?.user?.id;
      console.log('[RT-DBG] session', {uid: uid?.slice(0,8), email: data?.session?.user?.email});
      supabase.from('conversations').select('id').eq('tenant_id', tenantId).limit(1).then(({data: rows, error: qErr}) => {
        console.log('[RT-DBG] postrest-query', {rows: rows?.length, error: qErr?.message || null});
      });
    });
    // #endregion

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
      .channel(`livechat-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        // #region agent log
        (payload: unknown) => {
          console.log('[RT-DBG] INLINE-HIT', (payload as Record<string, unknown>)?.eventType);
          handleConversationChange(payload as RealtimePostgresChangesPayload<Conversation>);
        }
        // #endregion
      )
      .subscribe((status, err) => {
        // #region agent log
        console.log('[RT-DBG] status', {status, err: err?.message || null, retryCount: retryCountRef.current, channels: supabaseRef.current.getChannels().length});
        // #endregion

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
            // #region agent log
            console.log('[RT-DBG] retry scheduled', {retryCount: retryCountRef.current, delay, status});
            // #endregion
            retryTimeoutRef.current = setTimeout(() => {
              retryCountRef.current++;
              subscribe();
            }, delay);
          } else {
            console.error('[useRealtimeConversations] max retries reached, giving up');
            // #region agent log
            console.log('[RT-DBG] MAX RETRIES REACHED', {retryCount: retryCountRef.current});
            // #endregion
          }
        }
      });

    channelRef.current = channel;
  }, [tenantId, handleConversationChange]);

  useEffect(() => {
    subscribe();
    const supabase = supabaseRef.current;

    return () => {
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
      if (index === -1) return prev;
      const existing = prev[index];
      if (!existing) return prev;
      const result = [...prev];
      result[index] = { ...existing, ...updates };
      return result;
    });
  }, []);

  return { conversations, updateConversation };
}

function sortByLastMessage(convs: ConversationWithContact[]): ConversationWithContact[] {
  return [...convs].sort((a, b) => {
    const timeA = a.lastMessage?.timestamp || a.last_message_at || a.created_at;
    const timeB = b.lastMessage?.timestamp || b.last_message_at || b.created_at;
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });
}

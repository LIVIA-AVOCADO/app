'use client';

/**
 * Hook: useRealtimeConversations
 *
 * Canal único (single WebSocket) para todas as mudanças do livechat:
 * - UPDATE/INSERT/DELETE em conversations
 * - INSERT em messages (atualiza preview e move conversa para o topo)
 * - * em conversation_tags (atualiza tags)
 *
 * Design decisions:
 * - Um único .channel() com múltiplos .on() → menos pontos de falha,
 *   um único WebSocket, um único handler de status com retry
 * - supabase via useRef → instância única por hook, sem recriação
 * - Handlers via useRef → sempre acessam state/callbacks atuais
 *   sem precisar recriar o canal quando deps mudam
 * - Retry exponencial com MAX_RETRIES tentativas
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresDeletePayload, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { ConversationWithContact, ConversationTagWithTag } from '@/types/livechat';
import type { Conversation, Message } from '@/types/database-helpers';

const MAX_RETRIES = 10;
const BASE_DELAY = 1000;
const SORT_DEBOUNCE_MS = 100;

export function useRealtimeConversations(
  tenantId: string,
  initialConversations: ConversationWithContact[]
) {
  const [conversations, setConversations] = useState<ConversationWithContact[]>(
    () => sortByLastMessage(initialConversations)
  );

  // Instância única do Supabase — nunca recriada
  const supabaseRef = useRef(createClient());

  // Canal único para todos os eventos
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Controle de retry
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Proteção contra race condition: não sobrescrever estado do realtime
  // com dados SSR após a inscrição estar ativa
  const isSubscribedRef = useRef(false);
  const hasInitialDataRef = useRef(false);

  // Ref para o tenantId (usado dentro dos handlers sem recriar canal)
  const tenantIdRef = useRef(tenantId);
  useEffect(() => {
    tenantIdRef.current = tenantId;
  }, [tenantId]);

  // Debounce do sort para não re-ordenar a cada evento individual
  const debouncedSort = useDebouncedCallback(() => {
    setConversations((prev) => sortByLastMessage([...prev]));
  }, SORT_DEBOUNCE_MS);

  // Sincroniza dados SSR apenas quando a inscrição ainda não está ativa
  useEffect(() => {
    if (!isSubscribedRef.current || !hasInitialDataRef.current) {
      setConversations(sortByLastMessage(initialConversations));
      hasInitialDataRef.current = true;
    }
  }, [initialConversations]);

  // ============================================================
  // Handlers — usam refs para acessar supabase e tenantId atuais
  // ============================================================

  const handleConversationUpdate = useCallback((payload: { new: Conversation }) => {
    if (payload.new.tenant_id !== tenantIdRef.current) return;

    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === payload.new.id);
      if (index === -1) return prev;

      const existing = prev[index];
      if (!existing) return prev;

      const updated: ConversationWithContact = {
        ...existing,
        ...payload.new,
        contact: existing.contact,
        lastMessage: existing.lastMessage,
        conversation_tags: existing.conversation_tags,
        category: existing.category,
      };

      const lastMessageChanged = existing.last_message_at !== payload.new.last_message_at;
      if (lastMessageChanged && index !== 0) {
        return [updated, ...prev.filter((_, i) => i !== index)];
      }

      const result = [...prev];
      result[index] = updated;
      return result;
    });

    debouncedSort();
  }, [debouncedSort]);

  const handleConversationInsert = useCallback(async (payload: { new: Conversation }) => {
    if (payload.new.tenant_id !== tenantIdRef.current) return;

    const supabase = supabaseRef.current;
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        contacts!inner(*),
        conversation_tags(
          tag:tags(id, tag_name, color, is_category, order_index)
        )
      `)
      .eq('id', payload.new.id)
      .single();

    if (error || !data) return;

    setConversations((prev) => {
      if (prev.some((c) => c.id === data.id)) return prev;

      const dataAny = data as unknown as Record<string, unknown>;
      const tags = (dataAny.conversation_tags || []) as unknown as ConversationTagWithTag[];
      const category = (tags
        .map((ct) => ct.tag)
        .filter((tag) => tag && tag.is_category)
        .sort((a, b) => (a?.order_index || 0) - (b?.order_index || 0))[0] || null) as ConversationWithContact['category'];

      const newConv: ConversationWithContact = {
        ...data,
        contact: dataAny.contacts as unknown as ConversationWithContact['contact'],
        lastMessage: null,
        conversation_tags: tags,
        category,
      };

      return sortByLastMessage([newConv, ...prev]);
    });
  }, []);

  const handleConversationDelete = useCallback((payload: RealtimePostgresDeletePayload<{ id: string }>) => {
    setConversations((prev) => prev.filter((c) => c.id !== payload.old.id));
  }, []);

  const handleMessageInsert = useCallback((payload: { new: Message }) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === payload.new.conversation_id);
      if (index === -1) return prev;

      const existing = prev[index];
      if (!existing) return prev;

      const updated: ConversationWithContact = {
        ...existing,
        lastMessage: payload.new,
        last_message_at: payload.new.timestamp || payload.new.created_at,
        // Marca como não lida quando a mensagem é do cliente
        ...(payload.new.sender_type === 'customer' && {
          has_unread: true,
          unread_count: (existing.unread_count || 0) + 1,
        }),
      };

      // Sempre move para o topo quando nova mensagem chega
      if (index === 0) {
        const result = [...prev];
        result[0] = updated;
        return result;
      }

      return [updated, ...prev.filter((_, i) => i !== index)];
    });
  }, []);

  const handleTagsChange = useCallback(async (
    payload: RealtimePostgresChangesPayload<{ conversation_id: string }>
  ) => {
    const conversationId =
      payload.eventType === 'DELETE'
        ? payload.old?.conversation_id
        : payload.new?.conversation_id;

    if (!conversationId) return;

    const supabase = supabaseRef.current;
    const { data: tagsData, error } = await supabase
      .from('conversation_tags')
      .select(`
        id,
        tag_id,
        tag:tags(id, tag_name, color, is_category, order_index, active, created_at, id_tenant, prompt_to_ai)
      `)
      .eq('conversation_id', conversationId);

    if (error) return;

    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversationId);
      if (index === -1) return prev;

      const existing = prev[index];
      if (!existing) return prev;

      const tags = (tagsData || []) as unknown as ConversationTagWithTag[];
      const category = (tags
        .map((ct) => ct.tag)
        .filter((tag) => tag && tag.is_category)
        .sort((a, b) => (a?.order_index || 0) - (b?.order_index || 0))[0] || null) as ConversationWithContact['category'];

      const result = [...prev];
      result[index] = { ...existing, conversation_tags: tags, category };
      return result;
    });
  }, []);

  // ============================================================
  // Canal único com todos os listeners + retry robusto
  // ============================================================
  const subscribe = useCallback(() => {
    const supabase = supabaseRef.current;

    // Limpa canal anterior se existir
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`livechat:${tenantId}`, {
        config: { broadcast: { self: false } },
      })
      // --- conversations ---
      .on<Conversation>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        handleConversationUpdate
      )
      .on<Conversation>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        handleConversationInsert
      )
      .on<{ id: string }>(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'conversations' },
        handleConversationDelete
      )
      // --- messages (para atualizar preview + mover conversa ao topo) ---
      .on<Message>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        handleMessageInsert
      )
      // --- conversation_tags ---
      .on<{ conversation_id: string }>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_tags' },
        handleTagsChange
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          retryCountRef.current = 0;
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isSubscribedRef.current = false;

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
  }, [
    tenantId,
    handleConversationUpdate,
    handleConversationInsert,
    handleConversationDelete,
    handleMessageInsert,
    handleTagsChange,
  ]);

  useEffect(() => {
    subscribe();
    const supabase = supabaseRef.current;

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      isSubscribedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Atualização otimista — sem esperar realtime
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

// ============================================================
// Helper
// ============================================================
function sortByLastMessage(convs: ConversationWithContact[]): ConversationWithContact[] {
  return [...convs].sort((a, b) => {
    const timeA = a.lastMessage?.timestamp || a.last_message_at || a.created_at;
    const timeB = b.lastMessage?.timestamp || b.last_message_at || b.created_at;
    return new Date(timeB).getTime() - new Date(timeA).getTime();
  });
}

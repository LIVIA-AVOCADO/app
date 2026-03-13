'use client';

/**
 * Hook: useRealtimeConversations
 *
 * Versão otimizada que trabalha DIRETAMENTE com ConversationWithContact[]
 *
 * Subscreve em tempo real:
 * - Mudanças de status (UPDATE em conversations)
 * - Novas conversas (INSERT em conversations)
 * - Conversas deletadas (DELETE em conversations)
 * - Novas mensagens (INSERT em messages - para atualizar preview/timestamp)
 * - Mudanças em tags (INSERT/UPDATE/DELETE em conversation_tags)
 *
 * Inclui:
 * - Reconexão automática com backoff exponencial
 * - Proteção contra race condition (initialData vs realtime)
 * - Debounce no re-sort para performance
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresDeletePayload, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { ConversationWithContact, ConversationTagWithTag } from '@/types/livechat';
import type { Conversation, Message } from '@/types/database-helpers';

const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const SORT_DEBOUNCE_MS = 100; // Reduzido de 300ms para 100ms para melhor responsividade

export function useRealtimeConversations(
  tenantId: string,
  initialConversations: ConversationWithContact[]
) {
  // State
  const [conversations, setConversations] = useState<ConversationWithContact[]>(
    sortByLastMessage(initialConversations)
  );

  const supabase = createClient();

  // Refs for managing subscriptions and state
  const conversationsChannelRef = useRef<RealtimeChannel | null>(null);
  const messagesChannelRef = useRef<RealtimeChannel | null>(null);
  const tagsChannelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Race condition protection: track if subscription is ready
  const subscriptionReadyRef = useRef(false);
  const hasReceivedInitialDataRef = useRef(false);

  // Debounced sort function to avoid re-sorting on every message
  const debouncedSort = useDebouncedCallback(() => {
    setConversations((prev) => sortByLastMessage([...prev]));
  }, SORT_DEBOUNCE_MS);

  // Reset when initialConversations changes, but respect subscription state
  useEffect(() => {
    // Only update if subscription is not ready OR this is the first time
    if (!subscriptionReadyRef.current || !hasReceivedInitialDataRef.current) {
      setConversations(sortByLastMessage(initialConversations));
      hasReceivedInitialDataRef.current = true;
    }
  }, [initialConversations]);

  // ========================================
  // Handlers
  // ========================================

  // Handle conversation UPDATE
  // Se last_message_at mudou, move para o topo imediatamente
  const handleConversationUpdate = useCallback((payload: { new: Conversation }) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === payload.new.id);

      if (index === -1) return prev;

      const existing = prev[index];
      if (!existing) return prev;

      const updatedConversation: ConversationWithContact = {
        ...existing,
        ...payload.new,
        // Preserve data that doesn't come in realtime payload
        contact: existing.contact,
        lastMessage: existing.lastMessage,
        conversation_tags: existing.conversation_tags,
        category: existing.category,
      };

      // Se last_message_at mudou E não está no topo, move para o topo
      const lastMessageChanged = existing.last_message_at !== payload.new.last_message_at;

      if (lastMessageChanged && index !== 0) {
        const withoutCurrent = prev.filter((_, i) => i !== index);
        return [updatedConversation, ...withoutCurrent];
      }

      // Caso contrário, apenas atualiza no lugar
      const updated = [...prev];
      updated[index] = updatedConversation;
      return updated;
    });
    debouncedSort();
  }, [debouncedSort]);

  // Handle conversation INSERT
  const handleConversationInsert = useCallback(async (payload: { new: Conversation }) => {
    // Verify tenant
    if (payload.new.tenant_id !== tenantId) {
      return;
    }

    // Fetch complete conversation data
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        contacts!inner(*),
        conversation_tags(
          tag:tags(
            id,
            tag_name,
            color,
            is_category,
            order_index
          )
        )
      `)
      .eq('id', payload.new.id)
      .single();

    if (error || !data) {
      return;
    }

    setConversations((prev) => {
      // Avoid duplicates
      if (prev.some((c) => c.id === data.id)) {
        return prev;
      }

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
  }, [tenantId, supabase]);

  // Handle conversation DELETE
  const handleConversationDelete = useCallback((payload: RealtimePostgresDeletePayload<{ id: string }>) => {
    setConversations((prev) => prev.filter((c) => c.id !== payload.old.id));
  }, []);

  // Handle message INSERT
  // Move a conversa para o TOPO imediatamente quando uma mensagem chega
  const handleMessageInsert = useCallback((payload: { new: Message }) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === payload.new.conversation_id);

      if (index === -1) return prev;

      const existing = prev[index];
      if (!existing) return prev;

      // Atualiza a conversa com a nova mensagem
      const updatedConversation: ConversationWithContact = {
        ...existing,
        lastMessage: payload.new,
        last_message_at: payload.new.timestamp || payload.new.created_at,
      };

      // Se já está no topo, apenas atualiza
      if (index === 0) {
        const updated = [...prev];
        updated[0] = updatedConversation;
        return updated;
      }

      // Move para o topo IMEDIATAMENTE
      const withoutCurrent = prev.filter((_, i) => i !== index);
      return [updatedConversation, ...withoutCurrent];
    });
  }, []);

  // Handle tags changes
  const handleTagsChange = useCallback(async (payload: RealtimePostgresChangesPayload<{ conversation_id: string }>) => {
    const conversationId =
      payload.eventType === 'DELETE'
        ? payload.old?.conversation_id
        : payload.new?.conversation_id;

    if (!conversationId) return;

    // Fetch updated tags for the conversation
    const { data: tagsData, error: tagsError } = await supabase
      .from('conversation_tags')
      .select(`
        id,
        tag_id,
        tag:tags(
          id,
          tag_name,
          color,
          is_category,
          order_index,
          active,
          created_at,
          id_tenant,
          prompt_to_ai
        )
      `)
      .eq('conversation_id', conversationId);

    if (tagsError) {
      return;
    }

    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversationId);

      if (index === -1) {
        return prev;
      }

      const existing = prev[index];
      if (!existing) return prev;

      const tags = (tagsData || []) as unknown as ConversationTagWithTag[];
      const category = (tags
        .map((ct) => ct.tag)
        .filter((tag) => tag && tag.is_category)
        .sort((a, b) => (a?.order_index || 0) - (b?.order_index || 0))[0] || null) as ConversationWithContact['category'];

      const updated = [...prev];
      updated[index] = {
        ...existing,
        conversation_tags: tags,
        category,
      };
      return updated;
    });
  }, [supabase]);

  // ========================================
  // Subscribe with retry logic
  // ========================================
  const subscribe = useCallback(() => {
    // Clean up existing channels
    if (conversationsChannelRef.current) {
      supabase.removeChannel(conversationsChannelRef.current);
      conversationsChannelRef.current = null;
    }
    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current);
      messagesChannelRef.current = null;
    }
    if (tagsChannelRef.current) {
      supabase.removeChannel(tagsChannelRef.current);
      tagsChannelRef.current = null;
    }

    // ========================================
    // Channel 1: Conversations
    // Sem filtro server-side — filtragem por tenant feita nos handlers
    // para garantir recebimento dos eventos independente da configuração do Supabase
    // ========================================
    const conversationsChannel = supabase
      .channel(`tenant:${tenantId}:conversations`)
      .on<Conversation>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          if (payload.new.tenant_id !== tenantId) return;
          handleConversationUpdate(payload);
        }
      )
      .on<Conversation>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
        },
        handleConversationInsert
      )
      .on<{ id: string }>(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'conversations',
        },
        handleConversationDelete
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscriptionReadyRef.current = true;
          retryCountRef.current = 0;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          subscriptionReadyRef.current = false;

          if (retryCountRef.current < MAX_RETRIES) {
            const delay = Math.min(BASE_DELAY * Math.pow(2, retryCountRef.current), 30000);

            retryTimeoutRef.current = setTimeout(() => {
              retryCountRef.current++;
              subscribe();
            }, delay);
          }
        }
      });

    conversationsChannelRef.current = conversationsChannel;

    // ========================================
    // Channel 2: Messages
    // ========================================
    const messagesChannel = supabase
      .channel(`messages:tenant:${tenantId}`)
      .on<Message>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        handleMessageInsert
      )
      .subscribe();

    messagesChannelRef.current = messagesChannel;

    // ========================================
    // Channel 3: Tags
    // ========================================
    const tagsChannel = supabase
      .channel(`conversation_tags:tenant:${tenantId}`)
      .on<{ conversation_id: string }>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_tags',
        },
        handleTagsChange
      )
      .subscribe();

    tagsChannelRef.current = tagsChannel;
  }, [
    supabase,
    tenantId,
    handleConversationUpdate,
    handleConversationInsert,
    handleConversationDelete,
    handleMessageInsert,
    handleTagsChange,
  ]);

  useEffect(() => {
    subscribe();

    return () => {
      // Cleanup on unmount
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (conversationsChannelRef.current) {
        supabase.removeChannel(conversationsChannelRef.current);
      }
      if (messagesChannelRef.current) {
        supabase.removeChannel(messagesChannelRef.current);
      }
      if (tagsChannelRef.current) {
        supabase.removeChannel(tagsChannelRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  // Atualização otimista: atualiza uma conversa específica sem esperar realtime
  const updateConversation = useCallback((conversationId: string, updates: Partial<ConversationWithContact>) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.id === conversationId);
      if (index === -1) return prev;
      const existing = prev[index];
      if (!existing) return prev;
      const updated = [...prev];
      updated[index] = { ...existing, ...updates };
      return updated;
    });
  }, []);

  return { conversations, updateConversation };
}

// ========================================
// Helper: Sort by last message
// ========================================
function sortByLastMessage(
  convs: ConversationWithContact[]
): ConversationWithContact[] {
  return [...convs].sort((a, b) => {
    // Prioridade: lastMessage.timestamp > last_message_at > created_at
    // Isso garante que usamos o timestamp mais recente disponível
    const timeA = a.lastMessage?.timestamp || a.last_message_at || a.created_at;
    const timeB = b.lastMessage?.timestamp || b.last_message_at || b.created_at;

    // Usa getTime() para comparação numérica precisa
    const dateA = new Date(timeA).getTime();
    const dateB = new Date(timeB).getTime();

    // Ordenação decrescente (mais recente primeiro)
    return dateB - dateA;
  });
}

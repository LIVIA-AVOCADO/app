'use client';

/**
 * Hook: useRealtimeMessages
 *
 * Subscreve em tempo real às mensagens de uma conversa específica.
 *
 * Design decisions:
 * - supabase via useRef → instância única, sem recriação a cada render
 * - Canal recriado apenas quando conversationId muda
 * - Retry exponencial com MAX_RETRIES tentativas
 * - handleInsert async: busca info do sender apenas para mensagens
 *   de attendant; mensagens de customer/ai são adicionadas imediatamente
 * - clearTimeout APÓS removeChannel: removeChannel dispara CLOSED sincronamente,
 *   que agenda retry espúrio — deve ser limpo imediatamente depois
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MessageWithSender, MessageStatus } from '@/types/livechat';
import type { Message } from '@/types/database-helpers';
import { fetchLivechatMessagesFresh, fetchOlderMessages } from '@/lib/hooks/use-messages-cache';

const MAX_RETRIES = 10;
const BASE_DELAY = 1000;
const MESSAGES_PAGE_SIZE = 50;

export function useRealtimeMessages(
  conversationId: string,
  initialMessages: MessageWithSender[],
  /** Quando muda (ex.: via Realtime em `conversations`), força refetch se INSERT em `messages` não chegou. */
  conversationLastMessageAt?: string | null
) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);
  const [hasMore, setHasMore] = useState(() => initialMessages.length >= MESSAGES_PAGE_SIZE);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const isLoadingOlderRef = useRef(false);

  const supabaseRef = useRef(createClient());

  // Mapeia message.id → chave estável de renderização (JSX key).
  // Quando uma mensagem otimista (temp-xxx) é confirmada (real-uuid), a chave
  // permanece como temp-xxx, evitando desmonte/remonte e dupla animação.
  const stableKeyMapRef = useRef<Map<string, string>>(new Map());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevLastMessageAtRef = useRef<string | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
    setHasMore(initialMessages.length >= MESSAGES_PAGE_SIZE);
    isLoadingOlderRef.current = false;
    prevLastMessageAtRef.current = null;
    stableKeyMapRef.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    const at = conversationLastMessageAt;
    if (at == null || at === '') return;

    if (prevLastMessageAtRef.current === null) {
      prevLastMessageAtRef.current = at;
      return;
    }
    if (prevLastMessageAtRef.current === at) return;

    prevLastMessageAtRef.current = at;
    let cancelled = false;
    fetchLivechatMessagesFresh(conversationId)
      .then((fresh) => {
        if (!cancelled) setMessages(fresh);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [conversationId, conversationLastMessageAt]);

  const handleInsert = useCallback(async (payload: { new: Message }) => {
    const supabase = supabaseRef.current;
    let senderUser = null;

    if (payload.new.sender_type === 'attendant' && payload.new.sender_user_id) {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .eq('id', payload.new.sender_user_id)
        .single();
      senderUser = data;
    }

    // Resolve mensagem citada (reply do WhatsApp ou do atendente)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quotedMessageId = (payload.new as any).quoted_message_id as string | null | undefined;
    let quotedMessage = null;
    if (quotedMessageId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: qm } = await (supabase as any)
        .from('messages')
        .select(`
          id,
          content,
          sender_type,
          senderUser:users!messages_sender_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('id', quotedMessageId)
        .single();
      quotedMessage = qm ?? null;
    }

    const newMessage: MessageWithSender = { ...payload.new, senderUser, quotedMessage };
    setMessages((prev) => {
      // 1. Dedup por ID exato — replaceTempMessage já rodou antes do INSERT chegar
      const exactIdx = prev.findIndex((m) => m.id === newMessage.id);
      if (exactIdx !== -1) {
        const result = [...prev];
        result[exactIdx] = newMessage;
        // stableKey já foi transferido por replaceTempMessage; nada a fazer
        return result;
      }

      // 2. Substitui mensagem temp — INSERT chegou antes da resposta da API
      const tempIdx = prev.findIndex(
        (m) =>
          m.id.startsWith('temp-') &&
          m.content === newMessage.content &&
          m.sender_type === 'attendant' &&
          m.conversation_id === newMessage.conversation_id
      );
      if (tempIdx !== -1) {
        const tempId = prev[tempIdx]!.id;
        const stableKey = stableKeyMapRef.current.get(tempId) ?? tempId;
        stableKeyMapRef.current.delete(tempId);
        stableKeyMapRef.current.set(newMessage.id, stableKey);
        const result = [...prev];
        result[tempIdx] = newMessage;
        return result;
      }

      // 3. Mensagem nova (de outro remetente)
      stableKeyMapRef.current.set(newMessage.id, newMessage.id);
      return [...prev, newMessage];
    });
  }, []);

  const addMessage = useCallback((message: MessageWithSender) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      stableKeyMapRef.current.set(message.id, message.id);
      return [...prev, message];
    });
  }, []);

  const replaceTempMessage = useCallback(
    (tempId: string, confirmedMessage: MessageWithSender) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === tempId);
        if (idx === -1) return prev; // já substituído pelo Realtime INSERT
        const stableKey = stableKeyMapRef.current.get(tempId) ?? tempId;
        stableKeyMapRef.current.delete(tempId);
        stableKeyMapRef.current.set(confirmedMessage.id, stableKey);
        const next = [...prev];
        next[idx] = confirmedMessage;
        return next;
      });
    },
    []
  );

  const getStableKey = useCallback((id: string) => {
    return stableKeyMapRef.current.get(id) ?? id;
  }, []);

  const updateMessageStatus = useCallback((id: string, status: MessageStatus) => {
    setMessages((prev) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prev.map((m) => (m.id === id ? { ...m, status: status as any } : m))
    );
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const handleUpdate = useCallback((payload: { new: Message }) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === payload.new.id ? { ...msg, ...payload.new } : msg))
    );
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
      .channel(`messages:${conversationId}`)
      .on<Message>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleInsert
      )
      .on<Message>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        handleUpdate
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          retryCountRef.current = 0;
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (err) {
            console.error('[useRealtimeMessages] channel error:', err);
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
  }, [conversationId, handleInsert, handleUpdate]);

  useEffect(() => {
    const supabase = supabaseRef.current;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (!cancelled) subscribe();
    });

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
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
  }, [conversationId]);

  /** Ref espelho do estado messages — permite leitura síncrona sem stale closure. */
  const messagesRef = useRef<MessageWithSender[]>(initialMessages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const loadOlderMessages = useCallback(async (): Promise<number> => {
    if (isLoadingOlderRef.current || !hasMore) return 0;
    const oldest = messagesRef.current[0];
    if (!oldest) return 0;

    isLoadingOlderRef.current = true;
    setIsLoadingOlder(true);

    try {
      const older = await fetchOlderMessages(conversationId, oldest.timestamp);
      if (older.length === 0) {
        setHasMore(false);
        return 0;
      }
      if (older.length < 30) setHasMore(false);
      setMessages((current) => {
        const existingIds = new Set(current.map((m) => m.id));
        const toAdd = older.filter((m) => !existingIds.has(m.id));
        return toAdd.length > 0 ? [...toAdd, ...current] : current;
      });
      return older.length;
    } catch {
      return 0;
    } finally {
      isLoadingOlderRef.current = false;
      setIsLoadingOlder(false);
    }
  }, [conversationId, hasMore]);

  return { messages, hasMore, isLoadingOlder, loadOlderMessages, addMessage, replaceTempMessage, updateMessageStatus, removeMessage, getStableKey };
}

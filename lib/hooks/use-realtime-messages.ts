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
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { MessageWithSender } from '@/types/livechat';
import type { Message } from '@/types/database-helpers';

const MAX_RETRIES = 10;
const BASE_DELAY = 1000;

export function useRealtimeMessages(
  conversationId: string,
  initialMessages: MessageWithSender[]
) {
  const [messages, setMessages] = useState<MessageWithSender[]>(initialMessages);

  // Instância única do Supabase — nunca recriada
  const supabaseRef = useRef(createClient());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reseta mensagens ao trocar de conversa
  useEffect(() => {
    setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // INSERT — nova mensagem chegou
  const handleInsert = useCallback(async (payload: { new: Message }) => {
    const supabase = supabaseRef.current;
    let senderUser = null;

    // Busca dados do atendente apenas se necessário
    if (payload.new.sender_type === 'attendant' && payload.new.sender_user_id) {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, avatar_url')
        .eq('id', payload.new.sender_user_id)
        .single();
      senderUser = data;
    }

    const newMessage: MessageWithSender = { ...payload.new, senderUser };
    setMessages((prev) => {
      const existingIndex = prev.findIndex((m) => m.id === newMessage.id);
      // Substitui mensagem otimista (sem senderUser) pela versão completa do realtime
      if (existingIndex !== -1) {
        const result = [...prev];
        result[existingIndex] = newMessage;
        return result;
      }
      return [...prev, newMessage];
    });
  }, []);

  // Inserção otimista — chamada imediatamente após o envio, sem esperar realtime
  const addMessage = useCallback((message: MessageWithSender) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });
  }, []);

  // UPDATE — status ou conteúdo de mensagem alterado
  const handleUpdate = useCallback((payload: { new: Message }) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === payload.new.id ? { ...msg, ...payload.new } : msg))
    );
  }, []);

  const subscribe = useCallback(() => {
    const supabase = supabaseRef.current;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
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
    subscribe();
    const supabase = supabaseRef.current;

    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  return { messages, addMessage };
}

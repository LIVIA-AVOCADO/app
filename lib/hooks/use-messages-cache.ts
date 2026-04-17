'use client';

/**
 * useMessagesCache — Cache in-memory de mensagens para navegação client-side
 *
 * Design decisions:
 * - Fetch via Next.js API route (/api/livechat/messages):
 *   browser → Next.js → Supabase
 *   Garante compatibilidade com redes restritivas (ISPs com proxy/firewall)
 *   e valida tenant server-side antes de acessar o banco.
 *
 * - Deduplicação via inflight Map: hover prefetch e clique simultâneo
 *   compartilham a mesma Promise — zero fetches duplicados.
 *
 * - Cache module-level (Map, TTL 30s): persiste entre re-mounts.
 *
 * - invalidateMessagesCache(): exportada como função pura para que
 *   useRealtimeConversations possa chamar quando last_message_at muda.
 */

import { useCallback } from 'react';
import type { MessageWithSender } from '@/types/livechat';

interface CacheEntry {
  messages: MessageWithSender[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;

// Module-level: sobrevivem re-mounts
const messagesCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<MessageWithSender[]>>();

async function fetchMessagesFromApi(conversationId: string): Promise<MessageWithSender[]> {
  const res = await fetch(`/api/livechat/messages?conversationId=${conversationId}`);
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
  const { messages } = await res.json();
  return messages as MessageWithSender[];
}

/**
 * Invalida o cache de uma conversa.
 * Chamada pelo useRealtimeConversations quando last_message_at muda.
 */
export function invalidateMessagesCache(conversationId: string): void {
  messagesCache.delete(conversationId);
}

/**
 * Busca as últimas mensagens direto no Supabase (ignora cache em memória).
 * Usado quando `last_message_at` da conversa muda mas o evento INSERT em `messages`
 * não chegou pelo Realtime (ex.: tabela fora da publicação).
 */
export async function fetchLivechatMessagesFresh(
  conversationId: string
): Promise<MessageWithSender[]> {
  invalidateMessagesCache(conversationId);
  return fetchMessagesFromApi(conversationId);
}

/**
 * Busca mensagens anteriores a um determinado timestamp (scroll para cima / paginação).
 */
export async function fetchOlderMessages(
  conversationId: string,
  beforeTimestamp: string,
  limit = 30
): Promise<MessageWithSender[]> {
  const params = new URLSearchParams({
    conversationId,
    before: beforeTimestamp,
    limit: String(limit),
  });
  const res = await fetch(`/api/livechat/messages?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch older messages: ${res.status}`);
  const { messages } = await res.json();
  return messages as MessageWithSender[];
}

export function useMessagesCache() {
  const getCached = useCallback((conversationId: string): MessageWithSender[] | null => {
    const entry = messagesCache.get(conversationId);
    if (!entry) return null;
    if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
      messagesCache.delete(conversationId);
      return null;
    }
    return entry.messages;
  }, []);

  const setCache = useCallback((conversationId: string, messages: MessageWithSender[]) => {
    messagesCache.set(conversationId, { messages, fetchedAt: Date.now() });
  }, []);

  /**
   * Busca mensagens com cache + deduplicação de in-flight requests.
   *
   * Cenário coberto: hover prefetch inicia fetch → usuário clica antes de terminar
   * → ambos recebem a mesma Promise (zero fetch duplicado).
   */
  const fetchAndCache = useCallback(async (conversationId: string): Promise<MessageWithSender[]> => {
    // 1. Cache hit → instantâneo
    const cached = getCached(conversationId);
    if (cached) return cached;

    // 2. Já tem um fetch em andamento → reutiliza a mesma Promise
    const existing = inflight.get(conversationId);
    if (existing) return existing;

    // 3. Inicia novo fetch e registra como in-flight
    const promise = fetchMessagesFromApi(conversationId)
      .then((messages) => {
        setCache(conversationId, messages);
        return messages;
      })
      .finally(() => {
        inflight.delete(conversationId);
      });

    inflight.set(conversationId, promise);
    return promise;
  }, [getCached, setCache]);

  /**
   * Pré-carrega mensagens em background.
   * Reutiliza fetchAndCache para garantir deduplicação automática.
   */
  const prefetch = useCallback((conversationId: string): void => {
    fetchAndCache(conversationId).catch(() => {}); // Silencioso — best-effort
  }, [fetchAndCache]);

  return { getCached, setCache, fetchAndCache, prefetch };
}

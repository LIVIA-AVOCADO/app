'use client';

/**
 * useMessagesCache — Cache in-memory de mensagens para navegação client-side
 *
 * Design decisions:
 * - Cache module-level (Map): persiste entre re-mounts do componente
 * - TTL de 30s: curto o suficiente para ser seguro, longo o suficiente para
 *   que clicks rápidos entre conversas não disparem múltiplos fetches
 * - invalidateMessagesCache(): exportada como função pura (não hook) para que
 *   useRealtimeConversations possa chamá-la quando last_message_at muda
 * - prefetch(): fire-and-forget, sem duplicatas via prefetchingSet
 * - Sem localStorage: mensagens mudam via Realtime; cache em memória é suficiente
 *   e evita complexidade de invalidação persistente
 */

import { useCallback } from 'react';
import type { MessageWithSender } from '@/types/livechat';

interface CacheEntry {
  messages: MessageWithSender[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000; // 30 segundos

// Module-level: sobrevive re-mounts (navegações client-side)
const messagesCache = new Map<string, CacheEntry>();
const prefetchingSet = new Set<string>();

/**
 * Invalida o cache de uma conversa.
 * Chamada pelo useRealtimeConversations quando last_message_at muda.
 * Exportada como função pura (não precisa de hook).
 */
export function invalidateMessagesCache(conversationId: string): void {
  messagesCache.delete(conversationId);
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
   * Busca mensagens: retorna do cache se válido, senão faz fetch e cacheia.
   */
  const fetchAndCache = useCallback(async (conversationId: string): Promise<MessageWithSender[]> => {
    const cached = getCached(conversationId);
    if (cached) return cached;

    const res = await fetch(`/api/livechat/messages?conversationId=${conversationId}`);
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);

    const data = await res.json();
    setCache(conversationId, data.messages);
    return data.messages;
  }, [getCached, setCache]);

  /**
   * Pré-carrega mensagens em background sem bloquear a UI.
   * Ignora erros silenciosamente (é apenas uma otimização).
   * Evita fetches duplicados via prefetchingSet.
   */
  const prefetch = useCallback((conversationId: string): void => {
    if (getCached(conversationId) || prefetchingSet.has(conversationId)) return;

    prefetchingSet.add(conversationId);
    fetch(`/api/livechat/messages?conversationId=${conversationId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.messages) setCache(conversationId, data.messages);
      })
      .catch(() => {}) // Silencioso — prefetch é best-effort
      .finally(() => prefetchingSet.delete(conversationId));
  }, [getCached, setCache]);

  return { getCached, setCache, fetchAndCache, prefetch };
}

'use client';

/**
 * useMessagesCache — Cache in-memory de mensagens para navegação client-side
 *
 * Design decisions:
 * - Supabase client direto (sem passar pelo Next.js API route):
 *   browser → Supabase = 1 round trip
 *   browser → Next.js → Supabase = 2 round trips (overhead desnecessário)
 *   RLS do Supabase garante isolamento de tenant, igual ao que fazem
 *   useRealtimeConversations e useRealtimeMessages.
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
import { createClient } from '@/lib/supabase/client';
import type { MessageWithSender } from '@/types/livechat';

interface CacheEntry {
  messages: MessageWithSender[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;

// Module-level: sobrevivem re-mounts
const messagesCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<MessageWithSender[]>>();

// Singleton do Supabase client (evita recriar a cada chamada)
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

/**
 * Busca mensagens diretamente no Supabase (sem API route).
 * RLS garante que o usuário só vê mensagens do próprio tenant.
 */
async function fetchMessagesFromSupabase(conversationId: string): Promise<MessageWithSender[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select(`
      *,
      senderUser:users!messages_sender_user_id_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('conversation_id', conversationId)
    .order('timestamp', { ascending: false })
    .limit(50);

  if (error) throw error;
  // Reverter para ordem cronológica (mais antigas primeiro)
  return ((data || []) as MessageWithSender[]).reverse();
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
  return fetchMessagesFromSupabase(conversationId);
}

/**
 * Busca mensagens anteriores a um determinado timestamp (scroll para cima / paginação).
 */
export async function fetchOlderMessages(
  conversationId: string,
  beforeTimestamp: string,
  limit = 30
): Promise<MessageWithSender[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select(`
      *,
      senderUser:users!messages_sender_user_id_fkey(
        id,
        full_name,
        avatar_url
      )
    `)
    .eq('conversation_id', conversationId)
    .lt('timestamp', beforeTimestamp)
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return ((data || []) as MessageWithSender[]).reverse();
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
    const promise = fetchMessagesFromSupabase(conversationId)
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

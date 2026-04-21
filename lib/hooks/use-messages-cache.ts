'use client';

/**
 * useMessagesCache — Cache multi-camada de mensagens para navegação client-side
 *
 * L1 — in-memory Map (5 min TTL): zero latência, sobrevive re-mounts
 * L2 — localStorage (30 min TTL, últimas 30 msgs): sobrevive F5 / novas abas
 * L3 — fetch via /api/livechat/messages: fonte de verdade
 *
 * Deduplicação via inflight Map: hover prefetch e clique simultâneo
 * compartilham a mesma Promise — zero fetches duplicados.
 *
 * invalidateMessagesCache(): exportada para useRealtimeConversations
 * chamar quando last_message_at muda.
 *
 * prefetchConversationsBatched(ids): pré-aquece até 100 conversas em lotes
 * de 5 com 300 ms entre lotes; retorna função de abort para cleanup.
 */

import { useCallback } from 'react';
import type { MessageWithSender } from '@/types/livechat';

// ─── Constants ───────────────────────────────────────────────────────────────

const MEMORY_TTL_MS = 5 * 60 * 1000;   // 5 min
const LS_TTL_MS     = 30 * 60 * 1000;  // 30 min
const LS_PREFIX     = 'livechat:msgs:v1:';
const LS_MAX_MSGS   = 30;
const BATCH_SIZE    = 5;
const BATCH_DELAY   = 300; // ms between batches

// ─── Types ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  messages: MessageWithSender[];
  fetchedAt: number;
}

interface LsEntry {
  messages: MessageWithSender[];
  storedAt: number;
}

// ─── Module-level state (survives re-mounts) ─────────────────────────────────

const messagesCache = new Map<string, CacheEntry>();
const inflight      = new Map<string, Promise<MessageWithSender[]>>();

// ─── localStorage helpers ────────────────────────────────────────────────────

function lsKey(conversationId: string): string {
  return LS_PREFIX + conversationId;
}

function lsGet(conversationId: string): MessageWithSender[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(lsKey(conversationId));
    if (!raw) return null;
    const entry: LsEntry = JSON.parse(raw);
    if (Date.now() - entry.storedAt > LS_TTL_MS) {
      localStorage.removeItem(lsKey(conversationId));
      return null;
    }
    return entry.messages;
  } catch {
    return null;
  }
}

function lsEvict(): void {
  // Remove oldest livechat entry to free space
  const entries: { key: string; storedAt: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(LS_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const entry: LsEntry = JSON.parse(raw);
      entries.push({ key: k, storedAt: entry.storedAt });
    } catch {
      // corrupted — remove it
      localStorage.removeItem(k!);
    }
  }
  if (entries.length === 0) return;
  entries.sort((a, b) => a.storedAt - b.storedAt);
  localStorage.removeItem(entries[0].key);
}

function lsSet(conversationId: string, messages: MessageWithSender[]): void {
  if (typeof window === 'undefined') return;
  const entry: LsEntry = {
    messages: messages.slice(-LS_MAX_MSGS),
    storedAt: Date.now(),
  };
  try {
    localStorage.setItem(lsKey(conversationId), JSON.stringify(entry));
  } catch {
    // QuotaExceededError — evict one entry and retry once
    try {
      lsEvict();
      localStorage.setItem(lsKey(conversationId), JSON.stringify(entry));
    } catch {
      // best-effort — ignore if still fails
    }
  }
}

function lsDelete(conversationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(lsKey(conversationId));
  } catch {
    // ignore
  }
}

// ─── Core fetch-and-cache (module-level, reused by hook + prefetch) ──────────

async function fetchMessagesFromApi(conversationId: string): Promise<MessageWithSender[]> {
  const res = await fetch(`/api/livechat/messages?conversationId=${conversationId}`);
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
  const { messages } = await res.json();
  return messages as MessageWithSender[];
}

/**
 * L1 → L2 → L3 with deduplication.
 * Returns cached result immediately when available.
 */
async function fetchAndCacheCore(conversationId: string): Promise<MessageWithSender[]> {
  // L1 — memory
  const memEntry = messagesCache.get(conversationId);
  if (memEntry && Date.now() - memEntry.fetchedAt <= MEMORY_TTL_MS) {
    return memEntry.messages;
  }

  // L2 — localStorage
  const lsCached = lsGet(conversationId);
  if (lsCached) {
    messagesCache.set(conversationId, { messages: lsCached, fetchedAt: Date.now() });
    return lsCached;
  }

  // L3 — API (deduplicated via inflight map)
  const existing = inflight.get(conversationId);
  if (existing) return existing;

  const promise = fetchMessagesFromApi(conversationId)
    .then((messages) => {
      messagesCache.set(conversationId, { messages, fetchedAt: Date.now() });
      lsSet(conversationId, messages);
      return messages;
    })
    .finally(() => {
      inflight.delete(conversationId);
    });

  inflight.set(conversationId, promise);
  return promise;
}

// ─── Public exports ───────────────────────────────────────────────────────────

/**
 * Invalida o cache (L1 + L2) de uma conversa.
 * Chamada pelo useRealtimeConversations quando last_message_at muda.
 */
export function invalidateMessagesCache(conversationId: string): void {
  messagesCache.delete(conversationId);
  lsDelete(conversationId);
}

/**
 * Busca as últimas mensagens ignorando cache (força L3).
 * Usado quando last_message_at muda mas INSERT no Realtime não chegou.
 */
export async function fetchLivechatMessagesFresh(
  conversationId: string
): Promise<MessageWithSender[]> {
  invalidateMessagesCache(conversationId);
  return fetchAndCacheCore(conversationId);
}

/**
 * Busca mensagens anteriores a um timestamp (paginação / scroll para cima).
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

/**
 * Pré-aquece mensagens para uma lista de conversas em lotes de 5,
 * com 300 ms entre lotes. Prioriza conversas mais prioritárias (passadas primeiro).
 *
 * Retorna função de abort — chame no cleanup do useEffect.
 */
export function prefetchConversationsBatched(ids: string[]): () => void {
  let cancelled = false;

  async function run() {
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      if (cancelled) break;
      const batch = ids.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((id) => fetchAndCacheCore(id).catch(() => {}))
      );
      if (cancelled) break;
      if (i + BATCH_SIZE < ids.length) {
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, BATCH_DELAY);
          // Allow early abort
          const check = setInterval(() => {
            if (cancelled) { clearTimeout(t); clearInterval(check); resolve(); }
          }, 50);
          setTimeout(() => clearInterval(check), BATCH_DELAY + 100);
        });
      }
    }
  }

  run();
  return () => { cancelled = true; };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useMessagesCache() {
  const getCached = useCallback((conversationId: string): MessageWithSender[] | null => {
    const entry = messagesCache.get(conversationId);
    if (!entry) return lsGet(conversationId);
    if (Date.now() - entry.fetchedAt > MEMORY_TTL_MS) {
      messagesCache.delete(conversationId);
      return lsGet(conversationId);
    }
    return entry.messages;
  }, []);

  const setCache = useCallback((conversationId: string, messages: MessageWithSender[]) => {
    messagesCache.set(conversationId, { messages, fetchedAt: Date.now() });
    lsSet(conversationId, messages);
  }, []);

  const fetchAndCache = useCallback(
    (conversationId: string) => fetchAndCacheCore(conversationId),
    []
  );

  const prefetch = useCallback((conversationId: string): void => {
    fetchAndCacheCore(conversationId).catch(() => {});
  }, []);

  return { getCached, setCache, fetchAndCache, prefetch };
}

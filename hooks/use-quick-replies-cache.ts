import { useState, useEffect, useCallback, useRef } from 'react';
import type { QuickReply } from '@/types/livechat';

// ─── Camada L1: cache em memória (persiste entre montagens na mesma sessão) ───
interface CacheEntry {
  data: QuickReply[];
  timestamp: number;
  total: number;
}

const quickRepliesCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<FetchResult>>();

// ─── Camada L2: localStorage (persiste entre sessões / page refresh) ──────────
const LS_PREFIX = 'livia:qr:';
const LS_TTL = 24 * 60 * 60 * 1000; // 24h — quick replies raramente mudam

function lsKey(tenantId: string): string {
  return `${LS_PREFIX}${tenantId}`;
}

function readFromLS(tenantId: string): QuickReply[] | null {
  try {
    const raw = localStorage.getItem(lsKey(tenantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: QuickReply[]; timestamp: number };
    if (Date.now() - parsed.timestamp > LS_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeToLS(tenantId: string, data: QuickReply[]): void {
  try {
    localStorage.setItem(lsKey(tenantId), JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // quota exceeded ou SSR — ignora silenciosamente
  }
}

export function invalidateQuickRepliesLS(tenantId: string): void {
  try {
    localStorage.removeItem(lsKey(tenantId));
  } catch {}
  // Limpa memória também
  for (const key of quickRepliesCache.keys()) {
    if (key.startsWith(`quick-replies:${tenantId}`)) {
      quickRepliesCache.delete(key);
    }
  }
}

// ─── Constantes ────────────────────────────────────────────────────────────────
const CACHE_TTL = 3 * 60 * 1000; // 3 min para memória
const MAX_CACHE_ENTRIES = 50;

interface FetchResult {
  data: QuickReply[];
  total: number;
  hasMore: boolean;
}

interface UseQuickRepliesCacheOptions {
  tenantId: string;
  enabled?: boolean;
  limit?: number;
  search?: string;
  onError?: (error: Error) => void;
}

interface UseQuickRepliesCacheReturn {
  quickReplies: QuickReply[];
  popularQuickReplies: QuickReply[];
  total: number;
  hasMore: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
  loadMore: () => Promise<void>;
}

export function useQuickRepliesCache({
  tenantId,
  enabled = true,
  limit = 20,
  search,
  onError,
}: UseQuickRepliesCacheOptions): UseQuickRepliesCacheReturn {
  // Inicializa com dados do localStorage se disponíveis (zero delay na primeira abertura)
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>(() => {
    if (search || typeof window === 'undefined') return [];
    return readFromLS(tenantId) ?? [];
  });

  const [popularQuickReplies, setPopularQuickReplies] = useState<QuickReply[]>(() => {
    if (search || typeof window === 'undefined') return [];
    const cached = readFromLS(tenantId);
    if (!cached) return [];
    return cached.slice().sort((a, b) => b.usage_count - a.usage_count).slice(0, 5);
  });

  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  // Se já tem dados do LS, não mostra spinner na primeira abertura
  const [isLoading, setIsLoading] = useState(() => {
    if (search || typeof window === 'undefined') return false;
    return readFromLS(tenantId) === null;
  });
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const getCacheKey = useCallback((searchTerm?: string): string => {
    return searchTerm
      ? `quick-replies:${tenantId}:search:${searchTerm}`
      : `quick-replies:${tenantId}`;
  }, [tenantId]);

  const cleanOldCache = useCallback(() => {
    if (quickRepliesCache.size >= MAX_CACHE_ENTRIES) {
      const entries = Array.from(quickRepliesCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < 10 && i < entries.length; i++) {
        const entry = entries[i];
        if (entry) quickRepliesCache.delete(entry[0]);
      }
    }
  }, []);

  const fetchQuickReplies = useCallback(async (
    currentOffset: number,
    searchTerm?: string,
    signal?: AbortSignal
  ): Promise<FetchResult> => {
    const params = new URLSearchParams({
      tenantId,
      limit: String(limit),
      offset: String(currentOffset),
    });
    if (searchTerm) params.set('search', searchTerm);

    const cacheKey = `${getCacheKey(searchTerm)}:${currentOffset}`;

    // L1: memória
    const memoryCached = quickRepliesCache.get(cacheKey);
    if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL) {
      return {
        data: memoryCached.data,
        total: memoryCached.total,
        hasMore: memoryCached.data.length === limit,
      };
    }

    // Deduplicação
    const pending = pendingRequests.get(cacheKey);
    if (pending) return pending;

    const request = (async () => {
      try {
        const response = await fetch(`/api/quick-replies?${params.toString()}`, { signal });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        const data: QuickReply[] = result.data || [];
        const total: number = result.total || 0;

        cleanOldCache();

        // Salva L1 (memória)
        quickRepliesCache.set(cacheKey, { data, timestamp: Date.now(), total });

        // Salva L2 (localStorage) — apenas para a primeira página sem search
        if (!searchTerm && currentOffset === 0) {
          writeToLS(tenantId, data);
        }

        return { data, total, hasMore: result.hasMore || false };
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, request);
    return request;
  }, [tenantId, limit, getCacheKey, cleanOldCache]);

  const loadQuickReplies = useCallback(async (reset: boolean = false): Promise<void> => {
    if (!enabled || !tenantId) return;

    if (reset) {
      setOffset(0);
      if (!search) {
        // Não limpa a lista se temos dados do LS (stale-while-revalidate)
        const lsData = readFromLS(tenantId);
        if (!lsData) setQuickReplies([]);
      } else {
        setQuickReplies([]);
      }
    }

    if (mountedRef.current) setIsLoading(true);

    try {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const result = await fetchQuickReplies(
        reset ? 0 : offset,
        search,
        abortControllerRef.current.signal
      );

      if (!mountedRef.current) return;

      if (reset) {
        setQuickReplies(result.data);
        setOffset(result.data.length);
      } else {
        setQuickReplies(prev => [...prev, ...result.data]);
        setOffset(prev => prev + result.data.length);
      }

      setTotal(result.total);
      setHasMore(result.hasMore);

      if (reset || popularQuickReplies.length === 0) {
        const popular = result.data
          .slice()
          .sort((a, b) => b.usage_count - a.usage_count)
          .slice(0, 5);
        setPopularQuickReplies(popular);
      }

      setIsError(false);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof Error && err.name === 'AbortError') return;

      const e = err instanceof Error ? err : new Error('Erro desconhecido');
      setIsError(true);
      setError(e);
      onError?.(e);
      console.error('[useQuickRepliesCache] Error loading quick replies:', e);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [enabled, tenantId, search, offset, fetchQuickReplies, popularQuickReplies.length, onError]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || isLoading) return;
    await loadQuickReplies(false);
  }, [hasMore, isLoading, loadQuickReplies]);

  const refetch = useCallback(async (): Promise<void> => {
    // Invalida L1 e L2
    invalidateQuickRepliesLS(tenantId);
    await loadQuickReplies(true);
  }, [tenantId, loadQuickReplies]);

  const invalidate = useCallback((): void => {
    invalidateQuickRepliesLS(tenantId);
  }, [tenantId]);

  useEffect(() => {
    mountedRef.current = true;
    loadQuickReplies(true);

    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, enabled]);

  return {
    quickReplies,
    popularQuickReplies,
    total,
    hasMore,
    isLoading,
    isError,
    error,
    refetch,
    invalidate,
    loadMore,
  };
}

/**
 * Prefetch de quick replies em background.
 * Salva em localStorage para que a próxima abertura seja instantânea.
 */
export function usePrefetchQuickReplies({ tenantId }: { tenantId: string }) {
  useEffect(() => {
    if (!tenantId) return;

    // L1 hit
    const memoryCacheKey = `quick-replies:${tenantId}:0`;
    const memoryCached = quickRepliesCache.get(memoryCacheKey);
    if (memoryCached && Date.now() - memoryCached.timestamp < CACHE_TTL) return;

    // L2 hit
    const lsCached = readFromLS(tenantId);
    if (lsCached) return; // localStorage ainda válido

    // Busca e persiste
    const params = new URLSearchParams({ tenantId, limit: '20', offset: '0' });
    fetch(`/api/quick-replies?${params.toString()}`)
      .then(res => res.json())
      .then(result => {
        const data: QuickReply[] = result.data || [];
        quickRepliesCache.set(memoryCacheKey, {
          data,
          timestamp: Date.now(),
          total: result.total || 0,
        });
        writeToLS(tenantId, data);
      })
      .catch(err => {
        console.warn('[usePrefetchQuickReplies] Prefetch failed:', err);
      });
  }, [tenantId]);
}

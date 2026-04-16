import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebouncedValue } from './use-debounced-value';
import type { MessageSearchResult } from '@/types/livechat';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 400;

interface UseMessageSearchOptions {
  tenantId: string;
  query: string;
  enabled?: boolean;
}

interface UseMessageSearchReturn {
  results: MessageSearchResult[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
}

export function useMessageSearch({
  tenantId,
  query,
  enabled = true,
}: UseMessageSearchOptions): UseMessageSearchReturn {
  const [results, setResults] = useState<MessageSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const search = useCallback(async (q: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setIsError(false);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({ q, tenantId });
      const res = await fetch(
        `/api/livechat/search-messages?${params.toString()}`,
        { signal: abortRef.current.signal }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (mountedRef.current) {
        setResults((data as { results?: MessageSearchResult[] }).results ?? []);
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (mountedRef.current) {
        setIsError(true);
        setErrorMessage(err instanceof Error ? err.message : 'Erro desconhecido');
        setResults([]);
      }
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled || debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    search(debouncedQuery);
  }, [debouncedQuery, enabled, search]);

  return { results, isLoading, isError, errorMessage };
}

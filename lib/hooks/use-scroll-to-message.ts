import { useCallback, useRef } from 'react';

interface UseScrollToMessageOptions {
  /** Function that loads an older batch; returns count loaded (0 = no more). */
  loadOlderMessages: () => Promise<number>;
}

export function useScrollToMessage({ loadOlderMessages }: UseScrollToMessageOptions) {
  const isSearchingRef = useRef(false);

  const scrollToMessage = useCallback(async (messageId: string) => {
    if (isSearchingRef.current) return;
    isSearchingRef.current = true;

    const findAndScroll = (): boolean => {
      const el = document.querySelector(`[data-message-id="${messageId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    };

    try {
      // Check if already in DOM
      if (findAndScroll()) return;

      // Load older batches until the message appears or there are no more
      while (true) {
        const loaded = await loadOlderMessages();
        if (loaded === 0) break; // hasMore=false or already loading

        // Two rAF frames to ensure React re-render + DOM paint
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

        if (findAndScroll()) return;
      }
      // Not found after exhausting history — stop silently
    } finally {
      isSearchingRef.current = false;
    }
  }, [loadOlderMessages]);

  return { scrollToMessage };
}

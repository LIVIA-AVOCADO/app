'use client';

import { useRef, useCallback } from 'react';

// Throttle de 4s — presence dura 5s no WhatsApp.
// Chamadas mais frequentes seriam ignoradas de qualquer forma.
const THROTTLE_MS = 4000;

export function useWhatsAppPresence(conversationId: string, tenantId: string) {
  const lastSentRef = useRef<number>(0);

  const sendPresence = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current < THROTTLE_MS) return;
    lastSentRef.current = now;

    fetch('/api/send-presence', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ conversationId, tenantId }),
    }).catch(() => { /* best-effort */ });
  }, [conversationId, tenantId]);

  return { sendPresence };
}

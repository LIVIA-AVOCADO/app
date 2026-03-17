'use client';

import { useSyncExternalStore } from 'react';
import { formatRelativeTime } from '@/lib/utils/contact-list';

interface RelativeTimeProps {
  timestamp: string | null | undefined;
  className?: string;
}

function subscribe() {
  return () => {};
}

/**
 * Componente que renderiza tempo relativo apenas no cliente.
 * Evita erros de hydration causados por diferenças de timezone/clock
 * entre servidor e cliente.
 */
export function RelativeTime({ timestamp, className }: RelativeTimeProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  // No servidor e durante hidratação, não renderiza nada
  if (!mounted) {
    return null;
  }

  const timeDisplay = formatRelativeTime(timestamp);

  if (!timeDisplay) {
    return null;
  }

  return <span className={className}>{timeDisplay}</span>;
}

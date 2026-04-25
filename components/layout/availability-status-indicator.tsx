'use client';

import { useState, useTransition } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export type AvailabilityStatus = 'online' | 'busy' | 'offline';

const STATUS_CONFIG: Record<AvailabilityStatus, { label: string; color: string }> = {
  online:  { label: 'Disponível',  color: 'bg-green-500' },
  busy:    { label: 'Ocupado',     color: 'bg-yellow-500' },
  offline: { label: 'Offline',     color: 'bg-red-500' },
};

interface AvailabilityStatusIndicatorProps {
  status: AvailabilityStatus;
  onStatusChange?: (status: AvailabilityStatus) => void;
}

export function AvailabilityStatusIndicator({
  status: initialStatus,
  onStatusChange,
}: AvailabilityStatusIndicatorProps) {
  const [status, setStatus] = useState<AvailabilityStatus>(initialStatus);
  const [isPending, startTransition] = useTransition();

  const handleChange = (next: AvailabilityStatus) => {
    if (next === status || isPending) return;
    startTransition(async () => {
      const res = await fetch('/api/users/me/availability', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) {
        setStatus(next);
        onStatusChange?.(next);
      }
    });
  };

  const current = STATUS_CONFIG[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium transition-opacity',
            'text-white/70 hover:text-white hover:bg-white/10',
            isPending && 'opacity-50 pointer-events-none'
          )}
          title="Alterar disponibilidade"
        >
          <span className={cn('h-2 w-2 rounded-full shrink-0', current.color)} />
          <span className="group-data-[collapsible=icon]:hidden">{current.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Minha disponibilidade
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.entries(STATUS_CONFIG) as [AvailabilityStatus, typeof STATUS_CONFIG[AvailabilityStatus]][]).map(
          ([key, config]) => (
            <DropdownMenuItem
              key={key}
              className="gap-2 cursor-pointer"
              onClick={() => handleChange(key)}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0', config.color)} />
              {config.label}
              {key === status && (
                <span className="ml-auto text-xs text-muted-foreground">✓</span>
              )}
            </DropdownMenuItem>
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

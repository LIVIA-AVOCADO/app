'use client';

import { Wifi } from 'lucide-react';
import { ConnectionCard, type ChannelData } from './connection-card';

interface ConnectionManagerProps {
  channels: ChannelData[];
  canAct:   boolean;
}

export function ConnectionManager({ channels, canAct }: ConnectionManagerProps) {
  if (channels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Wifi className="h-6 w-6 text-zinc-400" />
        </div>
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Nenhum canal configurado
        </p>
        <p className="text-sm text-zinc-500 max-w-xs">
          Complete o onboarding para configurar sua conexão WhatsApp.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {channels.map((ch) => (
        <ConnectionCard key={ch.id} channel={ch} canAct={canAct} />
      ))}
    </div>
  );
}

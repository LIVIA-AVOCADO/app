'use client';

import { useState } from 'react';
import { PlusCircle, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConnectionCard, type ChannelData } from './connection-card';
import { AddChannelDialog } from './add-channel-dialog';

interface ConnectionManagerProps {
  channels: ChannelData[];
  canAct:   boolean;
}

export function ConnectionManager({ channels, canAct }: ConnectionManagerProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <>
      <div className="space-y-4">
        {/* Header com botão de adicionar */}
        {canAct && (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <PlusCircle className="h-4 w-4 mr-1.5" />
              Adicionar canal
            </Button>
          </div>
        )}

        {/* Lista de canais */}
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="h-12 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Wifi className="h-6 w-6 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Nenhum canal configurado
            </p>
            <p className="text-sm text-zinc-500 max-w-xs">
              {canAct
                ? 'Clique em "Adicionar canal" para configurar sua conexão WhatsApp.'
                : 'Complete o onboarding para configurar sua conexão WhatsApp.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((ch) => (
              <ConnectionCard key={ch.id} channel={ch} canAct={canAct} />
            ))}
          </div>
        )}
      </div>

      <AddChannelDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
      />
    </>
  );
}

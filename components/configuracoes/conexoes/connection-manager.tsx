'use client';

import { useState } from 'react';
import { PlusCircle, Wifi, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConnectionCard, type ChannelData } from './connection-card';
import { AddChannelDialog } from './add-channel-dialog';
import { AddMetaChannelDialog } from './add-meta-channel-dialog';

interface ConnectionManagerProps {
  channels: ChannelData[];
  canAct:   boolean;
}

type ProviderPick = 'evolution' | 'meta';

export function ConnectionManager({ channels, canAct }: ConnectionManagerProps) {
  const [addProvider, setAddProvider] = useState<ProviderPick | null>(null);

  return (
    <>
      <div className="space-y-4">
        {/* Header com botão de adicionar */}
        {canAct && (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <PlusCircle className="h-4 w-4 mr-1.5" />
                  Adicionar canal
                  <ChevronDown className="h-4 w-4 ml-1.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setAddProvider('evolution')}>
                  <span className="font-medium">WhatsApp (Evolution API)</span>
                  <span className="block text-xs text-zinc-500">Conexão via QR code</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddProvider('meta')}>
                  <span className="font-medium">WhatsApp (Meta Oficial)</span>
                  <span className="block text-xs text-zinc-500">Conexão via credenciais Meta</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

      {/* Dialogs */}
      <AddChannelDialog
        open={addProvider === 'evolution'}
        onClose={() => setAddProvider(null)}
      />

      <AddMetaChannelDialog
        open={addProvider === 'meta'}
        onClose={() => setAddProvider(null)}
      />
    </>
  );
}

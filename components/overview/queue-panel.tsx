'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, UserCheck } from 'lucide-react';
import Link from 'next/link';
import type { QueueConversation } from './types';

interface QueuePanelProps {
  queue: QueueConversation[];
  tenantId: string;
}

function formatWaitTime(isoDate: string | null): string {
  if (!isoDate) return '—';
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}min` : `${hrs}h`;
}

function getWaitBadgeVariant(isoDate: string | null): string {
  if (!isoDate) return 'bg-gray-100 text-gray-500';
  const mins = Math.floor((Date.now() - new Date(isoDate).getTime()) / 60_000);
  if (mins >= 30) return 'bg-red-500/10 text-red-600 border-red-200';
  if (mins >= 10) return 'bg-orange-500/10 text-orange-600 border-orange-200';
  return 'bg-green-500/10 text-green-600 border-green-200';
}

export function QueuePanel({ queue }: QueuePanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Fila de espera
          </CardTitle>
          <Badge variant="outline" className="text-xs tabular-nums">
            {queue.length} aguardando
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
            <UserCheck className="h-8 w-8 opacity-30" />
            <p className="text-sm">Fila vazia — todos atribuídos</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                    Contato
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                    Última mensagem
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                    Espera
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.map((conv) => (
                  <tr key={conv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[180px]">
                        {conv.contact_name ?? conv.contact_phone ?? 'Desconhecido'}
                      </p>
                      {conv.contact_name && conv.contact_phone && (
                        <p className="text-xs text-muted-foreground">{conv.contact_phone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {conv.last_message_at
                        ? new Date(conv.last_message_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs ${getWaitBadgeVariant(conv.last_message_at)}`}
                      >
                        {formatWaitTime(conv.last_message_at)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/inbox?conversation=${conv.id}`}
                        className="text-xs text-primary hover:underline whitespace-nowrap"
                      >
                        Abrir →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

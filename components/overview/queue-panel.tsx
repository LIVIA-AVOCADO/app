'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, UserCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { AgentOverview, QueueConversation } from './types';

interface QueuePanelProps {
  queue: QueueConversation[];
  tenantId: string;
  agents: AgentOverview[];
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

const STATUS_ORDER: Record<AgentOverview['availability_status'], number> = {
  online: 0,
  busy: 1,
  offline: 2,
};

const STATUS_DOT: Record<AgentOverview['availability_status'], string> = {
  online: 'bg-emerald-500',
  busy: 'bg-amber-500',
  offline: 'bg-gray-400',
};

export function QueuePanel({ queue, tenantId, agents }: QueuePanelProps) {
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});

  const sortedAgents = [...agents].sort(
    (a, b) => STATUS_ORDER[a.availability_status] - STATUS_ORDER[b.availability_status]
  );

  async function handleAssign(convId: string, agentId: string) {
    setAssigning((prev) => ({ ...prev, [convId]: true }));
    try {
      await fetch(`/api/conversations/${convId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: agentId, tenantId }),
      });
    } finally {
      setAssigning((prev) => ({ ...prev, [convId]: false }));
    }
  }

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
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">
                    Atribuir
                  </th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {queue.map((conv) => (
                  <tr key={conv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[160px]">
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
                      {assigning[conv.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Select
                          onValueChange={(agentId) => handleAssign(conv.id, agentId)}
                          disabled={sortedAgents.length === 0}
                        >
                          <SelectTrigger className="h-7 text-xs w-[140px]">
                            <SelectValue placeholder="Atribuir..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedAgents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[agent.availability_status]}`}
                                  />
                                  <span className="truncate max-w-[120px]">{agent.full_name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
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

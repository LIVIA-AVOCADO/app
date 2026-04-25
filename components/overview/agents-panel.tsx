'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import type { AgentOverview } from './types';

interface AgentsPanelProps {
  agents: AgentOverview[];
}

const STATUS_CONFIG = {
  online: { label: 'Online', dot: 'bg-green-500', badge: 'bg-green-500/10 text-green-600 border-green-200' },
  busy: { label: 'Ocupado', dot: 'bg-yellow-500', badge: 'bg-yellow-500/10 text-yellow-600 border-yellow-200' },
  offline: { label: 'Offline', dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const STATUS_ORDER = { online: 0, busy: 1, offline: 2 };

export function AgentsPanel({ agents }: AgentsPanelProps) {
  const sorted = [...agents].sort(
    (a, b) =>
      (STATUS_ORDER[a.availability_status] ?? 3) -
      (STATUS_ORDER[b.availability_status] ?? 3)
  );

  const onlineCount = agents.filter((a) => a.availability_status === 'online').length;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Agentes
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {onlineCount} online
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 pb-4">
            Nenhum agente configurado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((agent) => {
              const cfg = STATUS_CONFIG[agent.availability_status] ?? STATUS_CONFIG.offline;
              return (
                <li key={agent.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="relative shrink-0">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium select-none">
                      {agent.full_name.charAt(0).toUpperCase()}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${cfg.dot}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{agent.full_name}</p>
                    <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  </div>
                  {agent.open_count > 0 && (
                    <Badge variant="outline" className="text-xs tabular-nums shrink-0">
                      {agent.open_count}
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

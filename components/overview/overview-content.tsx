'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { createClient } from '@/lib/supabase/client';
import { StatsCards } from './stats-cards';
import { AgentsPanel } from './agents-panel';
import { QueuePanel } from './queue-panel';
import type { AgentOverview, QueueConversation, OverviewStats } from './types';

interface OverviewContentProps {
  tenantId: string;
  initialAgents: AgentOverview[];
  initialQueue: QueueConversation[];
  initialStats: OverviewStats;
}

export function OverviewContent({
  tenantId,
  initialAgents,
  initialQueue,
  initialStats,
}: OverviewContentProps) {
  const [agents, setAgents] = useState<AgentOverview[]>(initialAgents);
  const [queue, setQueue] = useState<QueueConversation[]>(initialQueue);
  const [stats, setStats] = useState<OverviewStats>(initialStats);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const supabaseRef = useRef(createClient());

  const refresh = useDebouncedCallback(async () => {
    setIsRefreshing(true);
    try {
      const sb = supabaseRef.current;

      const [agentsRes, agentConvsRes, queueRes, statsRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb as any)
          .from('users')
          .select('id, full_name, avatar_url, availability_status')
          .eq('tenant_id', tenantId)
          .eq('is_internal', false)
          .contains('modules', ['livechat'])
          .order('full_name'),

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb as any)
          .from('conversations')
          .select('assigned_to')
          .eq('tenant_id', tenantId)
          .eq('status', 'open')
          .not('assigned_to', 'is', null),

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb as any)
          .from('conversations')
          .select('id, last_message_at, created_at, contact:contacts(name, phone)')
          .eq('tenant_id', tenantId)
          .eq('status', 'open')
          .eq('ia_active', false)
          .is('assigned_to', null)
          .order('last_message_at', { ascending: true })
          .limit(100),

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb as any)
          .from('conversations')
          .select('status, ia_active, assigned_to, updated_at')
          .eq('tenant_id', tenantId)
          .in('status', ['open', 'closed']),
      ]);

      const convsByAgent: Record<string, number> = {};
      for (const c of (agentConvsRes.data ?? [])) {
        const id = c.assigned_to as string;
        convsByAgent[id] = (convsByAgent[id] ?? 0) + 1;
      }

      setAgents(
        (agentsRes.data ?? []).map((u: AgentOverview) => ({
          ...u,
          open_count: convsByAgent[u.id] ?? 0,
        }))
      );

      setQueue(
        (queueRes.data ?? []).map((c: {
          id: string;
          last_message_at: string | null;
          created_at: string;
          contact: { name: string | null; phone: string | null } | null;
        }) => ({
          id: c.id,
          last_message_at: c.last_message_at,
          created_at: c.created_at,
          contact_name: c.contact?.name ?? null,
          contact_phone: c.contact?.phone ?? null,
        }))
      );

      const today = new Date().toISOString().slice(0, 10);
      const all = (statsRes.data ?? []) as Array<{
        status: string;
        ia_active: boolean;
        assigned_to: string | null;
        updated_at: string;
      }>;
      setStats({
        open_total: all.filter((c) => c.status === 'open').length,
        closed_today: all.filter(
          (c) => c.status === 'closed' && c.updated_at?.startsWith(today)
        ).length,
        unassigned_manual: all.filter(
          (c) => c.status === 'open' && !c.ia_active && !c.assigned_to
        ).length,
        ia_active: all.filter((c) => c.status === 'open' && c.ia_active).length,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, 800);

  const subscribe = useCallback(() => {
    const sb = supabaseRef.current;

    const convChannel = sb
      .channel(`overview:${tenantId}:conversations`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => refresh()
      )
      .subscribe();

    const usersChannel = sb
      .channel(`overview:${tenantId}:users`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => refresh()
      )
      .subscribe();

    return () => {
      sb.removeChannel(convChannel);
      sb.removeChannel(usersChannel);
    };
  }, [tenantId, refresh]);

  useEffect(() => {
    return subscribe();
  }, [subscribe]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão em tempo real dos atendimentos
          </p>
        </div>

        <StatsCards stats={stats} isRefreshing={isRefreshing} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <QueuePanel queue={queue} tenantId={tenantId} />
          </div>
          <div>
            <AgentsPanel agents={agents} />
          </div>
        </div>
      </div>
    </div>
  );
}

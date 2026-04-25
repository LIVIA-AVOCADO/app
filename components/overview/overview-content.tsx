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

      // meia-noite BRT = 03:00 UTC
      const now = new Date();
      const localMs = now.getTime() - 3 * 60 * 60 * 1000;
      const localDate = new Date(localMs).toISOString().slice(0, 10);
      const todayStart = `${localDate}T03:00:00.000Z`;

      const [agentsRes, agentConvsRes, queueRes, openRes, closedRes, unassignedRes, iaRes] =
        await Promise.all([
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
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'open'),

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sb as any)
            .from('conversations')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'closed')
            .gte('updated_at', todayStart),

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sb as any)
            .from('conversations')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'open')
            .eq('ia_active', false)
            .is('assigned_to', null),

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (sb as any)
            .from('conversations')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'open')
            .eq('ia_active', true),
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

      setStats({
        open_total:        openRes.count       ?? 0,
        closed_today:      closedRes.count     ?? 0,
        unassigned_manual: unassignedRes.count ?? 0,
        ia_active:         iaRes.count         ?? 0,
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

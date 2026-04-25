import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OverviewContent } from '@/components/overview/overview-content';
import type { AgentOverview, QueueConversation, OverviewStats } from '@/components/overview/types';

export const metadata = {
  title: 'Overview | LIVIA',
};

export default async function OverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (supabase as any)
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (!userData?.tenant_id) redirect('/aguardando-acesso');
  if (userData.role !== 'super_admin') redirect('/inbox');

  const tenantId = userData.tenant_id as string;

  // Queries paralelas
  const [agentsRes, agentConvsRes, queueRes, statsRes] = await Promise.all([
    // Agentes com livechat
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('users')
      .select('id, full_name, avatar_url, availability_status')
      .eq('tenant_id', tenantId)
      .eq('is_internal', false)
      .contains('modules', ['livechat'])
      .order('full_name'),

    // Contagem de conversas abertas por agente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('conversations')
      .select('assigned_to')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .not('assigned_to', 'is', null),

    // Fila: manual + não atribuída + aberta
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('conversations')
      .select('id, last_message_at, created_at, contact:contacts(name, phone)')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .eq('ia_active', false)
      .is('assigned_to', null)
      .order('last_message_at', { ascending: true })
      .limit(100),

    // Stats gerais
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('conversations')
      .select('status, ia_active, assigned_to, updated_at')
      .eq('tenant_id', tenantId)
      .in('status', ['open', 'closed']),
  ]);

  // Montar agents com open_count
  const convsByAgent: Record<string, number> = {};
  for (const c of (agentConvsRes.data ?? [])) {
    const id = c.assigned_to as string;
    convsByAgent[id] = (convsByAgent[id] ?? 0) + 1;
  }

  const agents: AgentOverview[] = (agentsRes.data ?? []).map((u: AgentOverview) => ({
    ...u,
    open_count: convsByAgent[u.id] ?? 0,
  }));

  // Montar fila
  const queue: QueueConversation[] = (queueRes.data ?? []).map((c: {
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
  }));

  // Calcular stats
  const today = new Date().toISOString().slice(0, 10);
  const all = (statsRes.data ?? []) as Array<{
    status: string;
    ia_active: boolean;
    assigned_to: string | null;
    updated_at: string;
  }>;

  const stats: OverviewStats = {
    open_total: all.filter((c) => c.status === 'open').length,
    closed_today: all.filter(
      (c) => c.status === 'closed' && c.updated_at?.startsWith(today)
    ).length,
    unassigned_manual: all.filter(
      (c) => c.status === 'open' && !c.ia_active && !c.assigned_to
    ).length,
    ia_active: all.filter((c) => c.status === 'open' && c.ia_active).length,
  };

  return (
    <OverviewContent
      tenantId={tenantId}
      initialAgents={agents}
      initialQueue={queue}
      initialStats={stats}
    />
  );
}

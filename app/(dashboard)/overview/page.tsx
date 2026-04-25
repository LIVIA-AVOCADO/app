import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OverviewContent } from '@/components/overview/overview-content';
import type { AgentOverview, QueueConversation, OverviewStats } from '@/components/overview/types';

export const metadata = {
  title: 'Overview | LIVIA',
};

// Início do dia de hoje em UTC-3 (America/Sao_Paulo)
function startOfTodayBRT(): string {
  const now = new Date();
  // UTC-3 → adiciona 3h ao UTC para obter meia-noite local em UTC
  const offsetMs = 3 * 60 * 60 * 1000;
  const localMs = now.getTime() - offsetMs;
  const localDate = new Date(localMs).toISOString().slice(0, 10); // YYYY-MM-DD
  return `${localDate}T03:00:00.000Z`; // meia-noite BRT = 03:00 UTC
}

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
  const todayStart = startOfTodayBRT();

  const [agentsRes, agentConvsRes, queueRes, openRes, closedRes, unassignedRes, iaRes] =
    await Promise.all([
      // Agentes com livechat
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('users')
        .select('id, full_name, avatar_url, availability_status')
        .eq('tenant_id', tenantId)
        .eq('is_internal', false)
        .contains('modules', ['livechat'])
        .order('full_name'),

      // Conversas abertas com agente atribuído (para contar por agente)
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

      // COUNT: total abertas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'open'),

      // COUNT: fechadas hoje (desde meia-noite BRT)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'closed')
        .gte('updated_at', todayStart),

      // COUNT: manual + não atribuída + aberta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .eq('ia_active', false)
        .is('assigned_to', null),

      // COUNT: IA ativa + aberta
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('conversations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'open')
        .eq('ia_active', true),
    ]);

  // Agentes com contagem de conversas atribuídas
  const convsByAgent: Record<string, number> = {};
  for (const c of (agentConvsRes.data ?? [])) {
    const id = c.assigned_to as string;
    convsByAgent[id] = (convsByAgent[id] ?? 0) + 1;
  }

  const agents: AgentOverview[] = (agentsRes.data ?? []).map((u: AgentOverview) => ({
    ...u,
    open_count: convsByAgent[u.id] ?? 0,
  }));

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

  const stats: OverviewStats = {
    open_total:        openRes.count       ?? 0,
    closed_today:      closedRes.count     ?? 0,
    unassigned_manual: unassignedRes.count ?? 0,
    ia_active:         iaRes.count         ?? 0,
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

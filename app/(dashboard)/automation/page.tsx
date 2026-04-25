import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AutomationContent } from '@/components/automation/automation-content';
import type { UraConfig, UraRule } from '@/components/automation/types';

export const metadata = { title: 'Automação | LIVIA' };

export default async function AutomationPage() {
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

  const [configRes, rulesRes, teamsRes, agentsRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('ura_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle(),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('ura_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true }),

    // times para seleção nas regras
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('teams')
      .select('id, name, color')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name'),

    // agentes para assign_agent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('users')
      .select('id, full_name')
      .eq('tenant_id', tenantId)
      .eq('is_internal', false)
      .contains('modules', ['livechat'])
      .order('full_name'),
  ]);

  return (
    <AutomationContent
      tenantId={tenantId}
      initialConfig={configRes.data as UraConfig | null}
      initialRules={(rulesRes.data ?? []) as UraRule[]}
      teams={teamsRes.data ?? []}
      agents={agentsRes.data ?? []}
    />
  );
}

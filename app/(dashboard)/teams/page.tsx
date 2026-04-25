import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TeamsContent } from '@/components/teams/teams-content';

export const metadata = { title: 'Times | LIVIA' };

export default async function TeamsPage() {
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

  const [teamsRes, usersRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('teams')
      .select('id, name, description, color, is_active, created_at')
      .eq('tenant_id', tenantId)
      .order('name'),

    // Usuários elegíveis para times (livechat + não internal)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('users')
      .select('id, full_name, avatar_url, availability_status')
      .eq('tenant_id', tenantId)
      .eq('is_internal', false)
      .contains('modules', ['livechat'])
      .order('full_name'),
  ]);

  return (
    <TeamsContent
      tenantId={tenantId}
      initialTeams={teamsRes.data ?? []}
      eligibleUsers={usersRes.data ?? []}
    />
  );
}

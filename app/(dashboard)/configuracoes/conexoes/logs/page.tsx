import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ChannelLogs } from '@/components/configuracoes/conexoes/channel-logs';
import { MODULE_KEYS, isSuperAdmin } from '@/lib/permissions';
import type { ChannelLogEntry, SimpleChannel } from '@/components/configuracoes/conexoes/channel-logs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Logs de Conexão | LIVIA',
};

const PAGE_SIZE = 50;

export default async function ChannelLogsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userData } = await (supabase as any)
    .from('users')
    .select('tenant_id, role, modules')
    .eq('id', user.id)
    .single();

  if (!userData?.tenant_id) redirect('/aguardando-acesso');

  const modules  = (userData.modules as string[]) ?? [];
  const isAdmin  = isSuperAdmin(userData.role);

  if (!isAdmin && !modules.includes(MODULE_KEYS.CONEXOES) && !modules.includes(MODULE_KEYS.CONEXOES_VIEW)) {
    redirect('/inbox');
  }

  const tenantId = userData.tenant_id as string;
  const admin    = createAdminClient();

  const [logsRes, channelsRes, disconnectedRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('channel_connection_logs')
      .select(`
        id, tenant_id, channel_id, event_type, event_data, source, created_at,
        channel:channels(id, name)
      `, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('channels')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name'),

    // Contagem de canais desconectados para badge/alerta
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('connection_status', 'disconnected')
      .eq('is_active', true),
  ]);

  const logs             = (logsRes.data ?? [])    as ChannelLogEntry[];
  const total            = (logsRes.count ?? 0)    as number;
  const totalPages       = Math.ceil(total / PAGE_SIZE);
  const channels         = (channelsRes.data ?? []) as SimpleChannel[];
  const disconnectedCount = (disconnectedRes.count ?? 0) as number;

  return (
    <ChannelLogs
      tenantId={tenantId}
      initialLogs={logs}
      initialTotal={total}
      initialTotalPages={totalPages}
      channels={channels}
      disconnectedCount={disconnectedCount}
    />
  );
}

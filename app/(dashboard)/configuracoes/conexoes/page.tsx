import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConnectionManager } from '@/components/configuracoes/conexoes/connection-manager';
import { MODULE_KEYS, isSuperAdmin } from '@/lib/permissions';
import type { ChannelData } from '@/components/configuracoes/conexoes/connection-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Conexões | LIVIA',
  description: 'Gerencie as conexões de API do seu workspace',
};

export default async function ConexoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id, modules, role')
    .eq('id', user.id)
    .single();

  if (!userData?.tenant_id) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-destructive">Erro: Usuário sem tenant associado</p>
      </div>
    );
  }

  const tenantId = userData.tenant_id as string;
  const modules  = (userData.modules as string[]) ?? [];
  const role     = (userData.role as string) ?? 'user';

  // canAct: super_admin OU módulo 'conexoes' (não apenas view)
  const canAct = isSuperAdmin(role) || modules.includes(MODULE_KEYS.CONEXOES);

  const admin = createAdminClient();
  const { data: channels } = await admin
    .from('channels')
    .select('id, name, provider_external_channel_id, identification_number, connection_status, config_json')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .not('provider_external_channel_id', 'is', null)
    .order('created_at', { ascending: true });

  const channelList: ChannelData[] = (channels ?? []).map((ch) => ({
    id:                ch.id,
    name:              ch.name,
    instanceName:      ch.provider_external_channel_id as string,
    connectionStatus:  (ch.connection_status as string) ?? 'unknown',
    phoneNumber:       (ch.identification_number as string) ?? '',
    profileName:       null,
    profilePictureUrl: null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Conexões</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Gerencie as conexões de API do seu workspace. Reconecte, reinicie ou troque de número.
        </p>
      </div>

      <ConnectionManager channels={channelList} canAct={canAct} />
    </div>
  );
}

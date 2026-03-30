import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConnectionManager } from '@/components/configuracoes/conexoes/connection-manager';
import { Separator } from '@/components/ui/separator';
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
      <div className="flex items-center justify-center h-full">
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

  // 1. Fetch active channels for the tenant
  const { data: channels } = await admin
    .from('channels')
    .select('id, name, provider_external_channel_id, identification_number, connection_status, config_json, channel_provider_id')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .not('provider_external_channel_id', 'is', null)
    .order('created_at', { ascending: true });

  // 2. Fetch provider codes in a single separate query (avoids join syntax issues)
  const providerIds = [...new Set((channels ?? []).map((c) => c.channel_provider_id as string))];

  const { data: providers } = providerIds.length > 0
    ? await admin
        .from('channel_providers')
        .select('id, channel_provider_identifier_code')
        .in('id', providerIds)
    : { data: [] };

  const providerCodeMap = new Map<string, string>(
    (providers ?? []).map((p) => [p.id, (p.channel_provider_identifier_code as string) ?? ''])
  );

  function resolveProviderType(code: string): ChannelData['providerType'] {
    if (code === 'meta_oficial_whatsapp') return 'meta';
    if (code.startsWith('evolution'))     return 'evolution';
    return 'unknown';
  }

  const channelList: ChannelData[] = (channels ?? []).map((ch) => {
    const code = providerCodeMap.get(ch.channel_provider_id as string) ?? '';
    return {
      id:                ch.id,
      name:              ch.name,
      instanceName:      ch.provider_external_channel_id as string,
      connectionStatus:  (ch.connection_status as string) ?? 'unknown',
      phoneNumber:       (ch.identification_number as string) ?? '',
      profileName:       null,
      profilePictureUrl: null,
      providerType:      resolveProviderType(code),
    };
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Conexões</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Gerencie as conexões de API do seu workspace. Reconecte, reinicie ou troque de número.
          </p>
        </div>
      </div>

      <Separator />

      <ConnectionManager channels={channelList} canAct={canAct} />
    </div>
  );
}

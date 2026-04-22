/**
 * GET /api/configuracoes/conexoes/status
 *
 * Busca o status atual da conexão na Evolution API e sincroniza com o DB.
 * Retorna os dados do canal incluindo perfil conectado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { getConnectionState, fetchInstance } from '@/lib/evolution/client';
import { mapConnectionState, credsFromConfigJson } from '@/lib/evolution/utils';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const channelId = new URL(request.url).searchParams.get('channelId');

  // Resolve o channel_provider_id do provedor Meta para excluí-lo desta rota
  const { data: metaProvider } = await admin
    .from('channel_providers')
    .select('id')
    .eq('channel_provider_identifier_code', 'meta_oficial_whatsapp')
    .maybeSingle();

  let query = admin
    .from('channels')
    .select('id, name, identification_number, connection_status, config_json')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);

  if (channelId) query = query.eq('id', channelId);

  // Exclui canais Meta desta rota (eles têm endpoint próprio: /meta/status)
  if (metaProvider?.id) query = query.neq('channel_provider_id', metaProvider.id);

  const { data: channel, error } = await query.limit(1).maybeSingle();

  if (error || !channel) {
    return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instanceName = (channel.config_json as any)?.instance_name as string | undefined;
  if (!instanceName) {
    return NextResponse.json({ error: 'Canal sem instância configurada' }, { status: 404 });
  }

  try {
    const creds = credsFromConfigJson(channel.config_json);
    const [stateRes, instanceInfo] = await Promise.allSettled([
      getConnectionState(instanceName, creds),
      fetchInstance(instanceName, creds),
    ]);

    const rawState = stateRes.status === 'fulfilled'
      ? stateRes.value.instance.state
      : 'close';

    const connectionStatus = mapConnectionState(rawState);

    const info = instanceInfo.status === 'fulfilled' ? instanceInfo.value : null;
    const owner             = info?.instance.owner ?? null;
    const profileName       = info?.instance.profileName ?? null;
    const profilePictureUrl = info?.instance.profilePictureUrl ?? null;

    // Sincroniza DB:
    // - sempre que status muda
    // - ou quando identification_number está vazio mas owner já está disponível
    const ownerClean = owner ? owner.split(':')[0] : null;
    const needsStatusUpdate = channel.connection_status !== connectionStatus;
    const needsNumberUpdate = ownerClean && !channel.identification_number;

    if (needsStatusUpdate || needsNumberUpdate) {
      await admin
        .from('channels')
        .update({
          ...(needsStatusUpdate ? { connection_status: connectionStatus } : {}),
          ...(ownerClean ? { identification_number: ownerClean } : {}),
          ...(connectionStatus === 'disconnected' ? { identification_number: '' } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', channel.id);
    }

    return NextResponse.json({
      id:                  channel.id,
      name:                channel.name,
      instanceName,
      connectionStatus,
      phoneNumber:         owner ?? channel.identification_number,
      profileName,
      profilePictureUrl,
    });
  } catch (err) {
    console.error('[conexoes/status] error:', err);
    return NextResponse.json({ error: 'Erro ao consultar Evolution API' }, { status: 502 });
  }
}

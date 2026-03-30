/**
 * GET /api/configuracoes/conexoes/status
 *
 * Busca o status atual da conexão na Evolution API e sincroniza com o DB.
 * Retorna os dados do canal incluindo perfil conectado.
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { getConnectionState, fetchInstance } from '@/lib/evolution/client';

function mapState(state: string): string {
  if (state === 'open')       return 'connected';
  if (state === 'connecting') return 'connecting';
  return 'disconnected';
}

export async function GET() {
  const auth = await getAuthenticatedTenant();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();

  // Busca o canal Evolution do tenant
  const { data: channel, error } = await admin
    .from('channels')
    .select('id, name, provider_external_channel_id, identification_number, connection_status, config_json')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .not('provider_external_channel_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error || !channel) {
    return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
  }

  const instanceName = channel.provider_external_channel_id as string;

  try {
    const [stateRes, instanceInfo] = await Promise.allSettled([
      getConnectionState(instanceName),
      fetchInstance(instanceName),
    ]);

    const rawState = stateRes.status === 'fulfilled'
      ? stateRes.value.instance.state
      : 'close';

    const connectionStatus = mapState(rawState);

    const info = instanceInfo.status === 'fulfilled' ? instanceInfo.value : null;
    const owner            = info?.instance.owner ?? null;
    const profileName      = info?.instance.profileName ?? null;
    const profilePictureUrl = info?.instance.profilePictureUrl ?? null;

    // Sincroniza DB se o status mudou
    if (channel.connection_status !== connectionStatus) {
      await admin
        .from('channels')
        .update({
          connection_status: connectionStatus,
          ...(owner ? { identification_number: owner } : {}),
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

/**
 * POST /api/configuracoes/conexoes/disconnect
 *
 * Desvincula o número WhatsApp da instância (logout).
 * A instância Evolution permanece — apenas o número é removido.
 * Isso preserva o instanceName usado nos workflows n8n.
 *
 * Requer módulo 'conexoes' (ação).
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { logoutInstance, resolveInstanceName } from '@/lib/evolution/client';
import { MODULE_KEYS, isSuperAdmin } from '@/lib/permissions';

export async function POST() {
  const auth = await getAuthenticatedTenant();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isSuperAdmin(auth.role) && !auth.modules.includes(MODULE_KEYS.CONEXOES)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  const { data: channel } = await admin
    .from('channels')
    .select('id, provider_external_channel_id')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .not('provider_external_channel_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (!channel?.provider_external_channel_id) {
    return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
  }

  const instanceName = await resolveInstanceName(channel.provider_external_channel_id as string);

  try {
    await logoutInstance(instanceName);

    await admin
      .from('channels')
      .update({
        connection_status:   'disconnected',
        identification_number: '',
        updated_at:          new Date().toISOString(),
      })
      .eq('id', channel.id);

    return NextResponse.json({ success: true, connectionStatus: 'disconnected' });
  } catch (err) {
    console.error('[conexoes/disconnect] error:', err);
    return NextResponse.json({ error: 'Erro ao desconectar instância' }, { status: 502 });
  }
}

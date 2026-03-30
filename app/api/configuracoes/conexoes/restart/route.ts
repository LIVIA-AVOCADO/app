/**
 * POST /api/configuracoes/conexoes/restart
 *
 * Reinicia a instância Evolution (Baileys). Operação segura:
 * mantém o número vinculado, apenas reestabelece a conexão.
 *
 * Requer módulo 'conexoes' (ação).
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { restartInstance } from '@/lib/evolution/client';
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

  const instanceName = channel.provider_external_channel_id as string;

  try {
    await restartInstance(instanceName);

    await admin
      .from('channels')
      .update({ connection_status: 'connecting', updated_at: new Date().toISOString() })
      .eq('id', channel.id);

    return NextResponse.json({ success: true, connectionStatus: 'connecting' });
  } catch (err) {
    console.error('[conexoes/restart] error:', err);
    return NextResponse.json({ error: 'Erro ao reiniciar instância' }, { status: 502 });
  }
}

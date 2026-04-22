/**
 * POST /api/configuracoes/conexoes/restart
 *
 * Reinicia a instância Evolution (Baileys). Operação segura:
 * mantém o número vinculado, apenas reestabelece a conexão.
 *
 * Body: { channelId?: string }
 * Requer módulo 'conexoes' (ação).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { restartInstance } from '@/lib/evolution/client';
import { credsFromConfigJson } from '@/lib/evolution/utils';
import { MODULE_KEYS, isSuperAdmin } from '@/lib/permissions';

const bodySchema = z.object({
  channelId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isSuperAdmin(auth.role) && !auth.modules.includes(MODULE_KEYS.CONEXOES)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const channelId = parsed.success ? parsed.data.channelId : undefined;

  const admin = createAdminClient();

  let query = admin
    .from('channels')
    .select('id, config_json')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true);

  if (channelId) query = query.eq('id', channelId);

  const { data: channel } = await query.limit(1).maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instanceName = (channel?.config_json as any)?.instance_name as string | undefined;
  if (!instanceName) {
    return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
  }

  try {
    await restartInstance(instanceName, credsFromConfigJson(channel?.config_json));

    await admin
      .from('channels')
      .update({ connection_status: 'connecting', updated_at: new Date().toISOString() })
      .eq('id', channel!.id);

    return NextResponse.json({ success: true, connectionStatus: 'connecting' });
  } catch (err) {
    console.error('[conexoes/restart] error:', err);
    return NextResponse.json({ error: 'Erro ao reiniciar instância' }, { status: 502 });
  }
}

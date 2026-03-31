/**
 * PATCH /api/configuracoes/conexoes/meta/update-credentials
 *
 * Atualiza o access_token (e opcionalmente o phone_number_id) de um canal Meta.
 * Valida as novas credenciais na Graph API antes de salvar.
 *
 * Requer módulo 'conexoes' (ação).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { verifyPhoneNumber } from '@/lib/meta/client';
import { MODULE_KEYS, isSuperAdmin } from '@/lib/permissions';

const bodySchema = z.object({
  channelId:     z.string().uuid(),
  phoneNumberId: z.string().min(1, { message: 'Phone Number ID é obrigatório' }),
  accessToken:   z.string().min(1, { message: 'Access Token é obrigatório' }),
});

export async function PATCH(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isSuperAdmin(auth.role) && !auth.modules.includes(MODULE_KEYS.CONEXOES)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { channelId, phoneNumberId, accessToken } = parsed.data;
  const admin = createAdminClient();

  // Valida que o canal pertence ao tenant
  const { data: channel } = await admin
    .from('channels')
    .select('id, config_json')
    .eq('id', channelId)
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .maybeSingle();

  if (!channel) {
    return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
  }

  // Verifica novas credenciais na Meta Graph API
  let phoneInfo: Awaited<ReturnType<typeof verifyPhoneNumber>>;
  try {
    phoneInfo = await verifyPhoneNumber(phoneNumberId, accessToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Credenciais inválidas';
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  // Merge no config_json existente (não sobrescreve chaves não relacionadas)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingCfg = (channel.config_json as any) ?? {};
  const newCfg = {
    ...existingCfg,
    phone_number_id: phoneNumberId,
    access_token:    accessToken,
    verified_name:   phoneInfo.verifiedName,
  };

  const { error: updateError } = await admin
    .from('channels')
    .update({
      identification_number: phoneInfo.phoneNumber,
      connection_status:     'connected',
      config_json:           newCfg,
      updated_at:            new Date().toISOString(),
    })
    .eq('id', channelId);

  if (updateError) {
    console.error('[meta/update-credentials] db error:', updateError);
    return NextResponse.json({ error: 'Erro ao atualizar canal.' }, { status: 500 });
  }

  return NextResponse.json({
    channelId,
    phoneNumberId,
    phoneNumber:      phoneInfo.phoneNumber,
    verifiedName:     phoneInfo.verifiedName,
    connectionStatus: 'connected',
  });
}

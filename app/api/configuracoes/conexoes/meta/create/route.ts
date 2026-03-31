/**
 * POST /api/configuracoes/conexoes/meta/create
 *
 * Cria um canal Meta Official WhatsApp para o tenant.
 *
 * Comportamento de verificação:
 *   - Sucesso na Graph API   → salva com connection_status = 'connected'
 *   - Erro 4xx da Graph API  → retorna 422 (token/ID inválido — não salva)
 *   - Erro de rede / 5xx     → salva com connection_status = 'unknown' + warning
 *                              (usuário pode verificar depois via "Atualizar Status")
 *
 * Requer módulo 'conexoes' (ação).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { verifyPhoneNumber } from '@/lib/meta/client';
import { MODULE_KEYS, isSuperAdmin } from '@/lib/permissions';

const META_PROVIDER_CODE = 'meta_oficial_whatsapp';

const bodySchema = z.object({
  name:          z.string().min(1, { message: 'Nome do canal é obrigatório' }).max(60),
  phoneNumberId: z.string().min(1, { message: 'Phone Number ID é obrigatório' }),
  accessToken:   z.string().min(1, { message: 'Access Token é obrigatório' }),
});

export async function POST(request: NextRequest) {
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

  const { name, phoneNumberId, accessToken } = parsed.data;
  const admin = createAdminClient();

  // Localiza o channel_provider_id do provedor Meta
  const { data: provider } = await admin
    .from('channel_providers')
    .select('id')
    .eq('channel_provider_identifier_code', META_PROVIDER_CODE)
    .maybeSingle();

  if (!provider) {
    return NextResponse.json(
      { error: 'Provedor Meta não encontrado. Execute a migration de seed ou contate o suporte.' },
      { status: 422 }
    );
  }

  // ── Verifica credenciais na Meta Graph API ────────────────────────────────
  type VerifyOutcome =
    | { kind: 'verified';    phoneNumber: string; verifiedName: string }
    | { kind: 'rejected';    message: string }
    | { kind: 'unreachable' };

  let outcome: VerifyOutcome;

  try {
    const info = await verifyPhoneNumber(phoneNumberId, accessToken);
    outcome = { kind: 'verified', phoneNumber: info.phoneNumber, verifiedName: info.verifiedName };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    const isAuthError = /invalid|unauthorized|permission|token|oauth/i.test(message);

    if (isAuthError) {
      outcome = { kind: 'rejected', message };
    } else {
      console.warn('[meta/create] Graph API unreachable, saving with unknown status:', message);
      outcome = { kind: 'unreachable' };
    }
  }

  if (outcome.kind === 'rejected') {
    return NextResponse.json({ error: outcome.message }, { status: 422 });
  }

  const connectionStatus = outcome.kind === 'verified' ? 'connected' : 'unknown';
  const phoneNumber      = outcome.kind === 'verified' ? outcome.phoneNumber  : '';
  const verifiedName     = outcome.kind === 'verified' ? outcome.verifiedName : '';

  // Insere canal no banco — dados provider-specific em config_json
  const { data: channel, error: insertError } = await admin
    .from('channels')
    .insert({
      tenant_id:             auth.tenantId,
      channel_provider_id:   provider.id,
      name,
      identification_number: phoneNumber,
      connection_status:     connectionStatus,
      config_json: {
        phone_number_id: phoneNumberId,
        access_token:    accessToken,
        verified_name:   verifiedName || null,
      },
      is_active:             true,
      is_receiving_messages: true,
      is_sending_messages:   true,
    })
    .select('id')
    .single();

  if (insertError || !channel) {
    console.error('[meta/create] db insert error:', insertError);
    return NextResponse.json({ error: 'Erro ao registrar canal.' }, { status: 500 });
  }

  return NextResponse.json({
    channelId:        channel.id,
    phoneNumberId,
    phoneNumber,
    verifiedName,
    connectionStatus,
    warning: outcome.kind === 'unreachable'
      ? 'Canal salvo, mas não foi possível verificar as credenciais agora. Clique em "Atualizar Status" no card para verificar.'
      : undefined,
  });
}

/**
 * DELETE /api/configuracoes/conexoes/delete
 *
 * Remove a instância da Evolution API e faz soft delete do canal no banco
 * (is_active = false). Histórico de conversas é preservado.
 *
 * Requer módulo 'conexoes' (ação).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { credsFromConfigJson } from '@/lib/evolution/utils';
import { MODULE_KEYS, isSuperAdmin } from '@/lib/permissions';

const bodySchema = z.object({
  channelId: z.string().uuid(),
});

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isSuperAdmin(auth.role) && !auth.modules.includes(MODULE_KEYS.CONEXOES)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'channelId inválido' }, { status: 400 });
  }

  const { channelId } = parsed.data;
  const admin = createAdminClient();

  // Valida que o canal pertence ao tenant
  const { data: channel } = await admin
    .from('channels')
    .select('id, config_json, is_active')
    .eq('id', channelId)
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .maybeSingle();

  if (!channel) {
    return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instanceName = (channel.config_json as any)?.instance_name as string | undefined;
  if (!instanceName) {
    return NextResponse.json({ error: 'Canal sem instância configurada' }, { status: 422 });
  }

  // Remove da Evolution (ignora 404 — instância pode já não existir)
  const creds = credsFromConfigJson(channel.config_json);
  try {
    const res = await fetch(`${creds.baseUrl}/instance/delete/${encodeURIComponent(instanceName)}`, {
      method:  'DELETE',
      headers: { apikey: creds.apiKey },
    });
    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      console.error('[conexoes/delete] evolution error:', res.status, text);
      return NextResponse.json({ error: 'Erro ao deletar instância na Evolution.' }, { status: 502 });
    }
  } catch (err) {
    console.error('[conexoes/delete] evolution fetch error:', err);
    return NextResponse.json({ error: 'Erro de conexão com a Evolution API.' }, { status: 502 });
  }

  // Soft delete no banco
  const { error: updateError } = await admin
    .from('channels')
    .update({
      is_active:         false,
      connection_status: 'disconnected',
      updated_at:        new Date().toISOString(),
    })
    .eq('id', channelId);

  if (updateError) {
    console.error('[conexoes/delete] db error:', updateError);
    return NextResponse.json({ error: 'Instância removida da Evolution mas erro ao atualizar banco.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

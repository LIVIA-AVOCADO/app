/**
 * DELETE /api/configuracoes/conexoes/meta/delete
 *
 * Faz soft delete do canal Meta no banco (is_active = false).
 * Não há instância externa para remover — o token Meta é gerenciado
 * pelo Meta Business Manager, não por esta aplicação.
 *
 * Requer módulo 'conexoes' (ação).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
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

  // Valida que o canal pertence ao tenant e está ativo
  const { data: channel } = await admin
    .from('channels')
    .select('id')
    .eq('id', channelId)
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .maybeSingle();

  if (!channel) {
    return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
  }

  const { error: updateError } = await admin
    .from('channels')
    .update({
      is_active:         false,
      connection_status: 'disconnected',
      updated_at:        new Date().toISOString(),
    })
    .eq('id', channelId);

  if (updateError) {
    console.error('[meta/delete] db error:', updateError);
    return NextResponse.json({ error: 'Erro ao remover canal.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

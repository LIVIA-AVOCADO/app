/**
 * GET /api/configuracoes/conexoes/qrcode/[instance]
 *
 * Retorna QR code atualizado para a instância durante o fluxo de reconexão.
 * Usado para refresh periódico do QR (expira em ~20s).
 *
 * Requer módulo 'conexoes' (ação).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { connectInstance } from '@/lib/evolution/client';
import { credsFromConfigJson } from '@/lib/evolution/utils';
import { MODULE_KEYS, isSuperAdmin } from '@/lib/permissions';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ instance: string }> }
) {
  const auth = await getAuthenticatedTenant();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isSuperAdmin(auth.role) && !auth.modules.includes(MODULE_KEYS.CONEXOES)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { instance: instanceName } = await params;

  // Busca o canal pelo instance_name para obter as credenciais corretas da Evolution
  const admin = createAdminClient();
  const { data: channel } = await admin
    .from('channels')
    .select('config_json')
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .contains('config_json', { instance_name: instanceName })
    .maybeSingle();

  try {
    const qr = await connectInstance(instanceName, credsFromConfigJson(channel?.config_json));
    return NextResponse.json({ base64: qr.base64, pairingCode: qr.pairingCode ?? null });
  } catch (err) {
    console.error('[conexoes/qrcode] error:', err);
    return NextResponse.json({ error: 'Erro ao obter QR code' }, { status: 502 });
  }
}

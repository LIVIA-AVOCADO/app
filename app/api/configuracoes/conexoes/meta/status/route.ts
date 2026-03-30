/**
 * GET /api/configuracoes/conexoes/meta/status?channelId={id}
 *
 * Verifica o status atual do canal Meta re-consultando a Graph API
 * e sincroniza connection_status no banco.
 *
 * Retorna os dados do canal incluindo nome verificado e número.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { verifyPhoneNumber } from '@/lib/meta/client';

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedTenant();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const channelId = new URL(request.url).searchParams.get('channelId');
  if (!channelId) {
    return NextResponse.json({ error: 'channelId é obrigatório' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: channel, error } = await admin
    .from('channels')
    .select('id, name, provider_external_channel_id, identification_number, instance_company_name, connection_status, config_json')
    .eq('id', channelId)
    .eq('tenant_id', auth.tenantId)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !channel) {
    return NextResponse.json({ error: 'Canal não encontrado' }, { status: 404 });
  }

  const phoneNumberId = channel.provider_external_channel_id as string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const accessToken   = (channel.config_json as any)?.access_token as string | undefined;

  if (!accessToken) {
    return NextResponse.json({ error: 'Access token não configurado' }, { status: 422 });
  }

  let connectionStatus: string;
  let phoneNumber    = channel.identification_number as string;
  let verifiedName   = channel.instance_company_name as string | null;

  try {
    const info = await verifyPhoneNumber(phoneNumberId, accessToken);
    connectionStatus = 'connected';
    phoneNumber      = info.phoneNumber;
    verifiedName     = info.verifiedName;
  } catch {
    connectionStatus = 'disconnected';
  }

  // Sincroniza DB se o status mudou
  if (channel.connection_status !== connectionStatus) {
    await admin
      .from('channels')
      .update({
        connection_status:     connectionStatus,
        identification_number: phoneNumber,
        instance_company_name: verifiedName ?? undefined,
        updated_at:            new Date().toISOString(),
      })
      .eq('id', channel.id);
  }

  return NextResponse.json({
    id:               channel.id,
    name:             channel.name,
    phoneNumberId,
    connectionStatus,
    phoneNumber,
    verifiedName,
  });
}

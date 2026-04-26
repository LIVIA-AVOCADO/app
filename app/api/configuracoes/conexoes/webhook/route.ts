/**
 * POST /api/configuracoes/conexoes/webhook
 *
 * Recebe eventos de CONNECTION_UPDATE da Evolution API.
 * Não exige autenticação de usuário — usa secret token no header.
 *
 * Configurar na Evolution API:
 *   webhook.url  = {APP_URL}/api/configuracoes/conexoes/webhook
 *   webhook.events = ["CONNECTION_UPDATE"]
 *   webhook.headers = { "x-webhook-token": EVOLUTION_WEBHOOK_SECRET }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mapConnectionState } from '@/lib/evolution/utils';

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    state?: 'open' | 'close' | 'connecting' | 'refused';
  };
}

export async function POST(request: NextRequest) {
  // Valida secret token
  if (WEBHOOK_SECRET) {
    const token = request.headers.get('x-webhook-token');
    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload: EvolutionWebhookPayload;
  try {
    payload = await request.json() as EvolutionWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.event !== 'connection.update' && payload.event !== 'CONNECTION_UPDATE') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const instanceName     = payload.instance;
  const rawState         = payload.data?.state ?? 'close';
  const connectionStatus = mapConnectionState(rawState);

  const admin = createAdminClient();

  const { data: channel } = await admin
    .from('channels')
    .select('id, connection_status')
    .filter('config_json->>instance_name', 'eq', instanceName)
    .limit(1)
    .maybeSingle();

  if (!channel) {
    // Instância não registrada neste sistema — ignora silenciosamente
    return NextResponse.json({ ok: true, skipped: true });
  }

  if (channel.connection_status !== connectionStatus) {
    await admin
      .from('channels')
      .update({
        connection_status: connectionStatus,
        ...(connectionStatus === 'disconnected' ? { identification_number: '' } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', channel.id);

    console.warn(
      `[conexoes/webhook] ${instanceName}: ${channel.connection_status} → ${connectionStatus}`
    );
  }

  // Grava log de conexão independente de mudança de status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: channelFull } = await (admin as any)
    .from('channels')
    .select('tenant_id')
    .eq('id', channel.id)
    .single();

  if (channelFull?.tenant_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('channel_connection_logs')
      .insert({
        tenant_id:  channelFull.tenant_id,
        channel_id: channel.id,
        event_type: connectionStatus === 'connected' ? 'connected' : 'disconnected',
        event_data: { raw_state: rawState, instance: instanceName },
        source:     'evolution',
      });
  }

  return NextResponse.json({ ok: true });
}

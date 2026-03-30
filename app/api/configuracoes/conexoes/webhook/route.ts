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

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;

interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    state?: 'open' | 'close' | 'connecting';
  };
}

function mapState(state: string): string {
  if (state === 'open')       return 'connected';
  if (state === 'connecting') return 'connecting';
  return 'disconnected';
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

  const instanceName    = payload.instance;
  const rawState        = payload.data?.state ?? 'close';
  const connectionStatus = mapState(rawState);

  const admin = createAdminClient();

  const { data: channel } = await admin
    .from('channels')
    .select('id, connection_status')
    .eq('provider_external_channel_id', instanceName)
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

  return NextResponse.json({ ok: true });
}

/**
 * GET/POST /api/configuracoes/conexoes/meta/webhook
 *
 * Webhook handler para a Meta WhatsApp Cloud API.
 *
 * GET  — Verificação do endpoint (hub challenge). Registrar na Meta:
 *   Webhook URL:    {APP_URL}/api/configuracoes/conexoes/meta/webhook
 *   Verify Token:   META_WEBHOOK_VERIFY_TOKEN (env var)
 *   Subscriptions:  messages, message_status_updates
 *
 * POST — Recebe eventos de status de mensagem. Atualiza connection_status
 *        quando o número é bloqueado/habilitado pelo Meta.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

// ── GET: hub challenge verification ──────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// ── POST: incoming events ─────────────────────────────────────────────────────

interface MetaWebhookEntry {
  id:      string;  // WhatsApp Business Account ID
  changes: Array<{
    value: {
      messaging_product: string;
      metadata?: {
        phone_number_id?: string;
      };
      statuses?: Array<{
        id:        string;
        status:    'sent' | 'delivered' | 'read' | 'failed';
        timestamp: string;
        recipient_id: string;
        errors?:   Array<{ code: number; title: string }>;
      }>;
      errors?: Array<{ code: number; title: string; message?: string }>;
    };
    field: string;
  }>;
}

interface MetaWebhookPayload {
  object: string;
  entry:  MetaWebhookEntry[];
}

export async function POST(request: NextRequest) {
  let payload: MetaWebhookPayload;
  try {
    payload = await request.json() as MetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (payload.object !== 'whatsapp_business_account') {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const admin = createAdminClient();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      // Se houver erros de nível de valor (ex: número bloqueado pela Meta),
      // marcamos o canal como desconectado.
      const hasErrors = (change.value?.errors?.length ?? 0) > 0;
      if (hasErrors) {
        await admin
          .from('channels')
          .update({
            connection_status: 'disconnected',
            updated_at:        new Date().toISOString(),
          })
          .eq('provider_external_channel_id', phoneNumberId)
          .eq('is_active', true);

        console.warn(`[meta/webhook] phoneNumberId ${phoneNumberId} marcado como desconectado por erro Meta`);
      }
    }
  }

  // Meta exige 200 rápido; processamento assíncrono quando necessário
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/configuracoes/conexoes/create
 *
 * Cria uma nova instância Evolution + canal no banco para o tenant.
 * Retorna QR code para conexão imediata.
 *
 * Requer módulo 'conexoes' (ação).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedTenant } from '@/lib/auth/get-authenticated-tenant';
import { connectInstance, configureInstanceWebhook, configureInstanceSettings, fetchInstanceId } from '@/lib/evolution/client';
import { MODULE_KEYS, isSuperAdmin } from '@/lib/permissions';

const EVOLUTION_BASE = process.env.EVOLUTION_API_BASE_URL!;
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY!;

const bodySchema = z.object({
  name: z.string().min(1, { message: 'Nome do canal é obrigatório' }).max(60),
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
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }, { status: 400 });
  }

  const { name } = parsed.data;
  const admin     = createAdminClient();

  // Resolve channel_provider_id: niche_channel_defaults do tenant → fallback canal existente
  const { data: tenant } = await admin
    .from('tenants')
    .select('niche_id')
    .eq('id', auth.tenantId)
    .single();

  let channelProviderId: string | null = null;

  if (tenant?.niche_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: defaults } = await (admin.from as any)('niche_channel_defaults')
      .select('channel_provider_id')
      .eq('niche_id', tenant.niche_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    channelProviderId = defaults?.channel_provider_id ?? null;
  }

  if (!channelProviderId) {
    const { data: existing } = await admin
      .from('channels')
      .select('channel_provider_id')
      .eq('tenant_id', auth.tenantId)
      .not('channel_provider_id', 'is', null)
      .limit(1)
      .maybeSingle();
    channelProviderId = existing?.channel_provider_id ?? null;
  }

  if (!channelProviderId) {
    return NextResponse.json(
      { error: 'Configuração de provedor não encontrada para este tenant.' },
      { status: 422 }
    );
  }

  // Gera instanceName único: livia-{8 hex chars}
  const instanceName = `livia-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

  // Cria instância na Evolution
  const evolRes = await fetch(`${EVOLUTION_BASE}/instance/create`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: EVOLUTION_KEY },
    body:    JSON.stringify({
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode:      true,
    }),
  });

  if (!evolRes.ok && evolRes.status !== 403) {
    const text = await evolRes.text();
    console.error('[conexoes/create] evolution error:', evolRes.status, text);
    return NextResponse.json({ error: 'Erro ao criar instância Evolution.' }, { status: 502 });
  }

  // Lê apikey do response (disponível apenas na criação bem-sucedida)
  let apikeyInstance: string | null = null;
  if (evolRes.ok) {
    try {
      const evolData = await evolRes.json() as { hash?: { apikey?: string } };
      apikeyInstance = evolData?.hash?.apikey ?? null;
    } catch { /* ignora */ }
  }

  const webhookUrl = process.env.EVOLUTION_INSTANCE_WEBHOOK_URL ?? null;

  // Busca o UUID interno da instância na Evolution + aplica configurações em paralelo
  const [instanceId] = await Promise.all([
    fetchInstanceId(instanceName),
    configureInstanceWebhook(instanceName),
    configureInstanceSettings(instanceName),
  ]);

  // Insere canal no banco
  const { data: channel, error: insertError } = await admin
    .from('channels')
    .insert({
      tenant_id:             auth.tenantId,
      channel_provider_id:   channelProviderId,
      name,
      identification_number: '',
      connection_status:     'connecting',
      config_json: {
        instance_name:   instanceName,
        instance_id:     instanceId ?? null,
        apikey_instance: apikeyInstance,
        webhook_url:     webhookUrl,
        settings: {
          reject_call:       true,
          msg_call:          'No momento só consigo falar por mensagens...',
          groups_ignore:     true,
          always_online:     false,
          read_messages:     false,
          read_status:       false,
          sync_full_history: false,
        },
      },
      is_active:             true,
      is_receiving_messages: true,
      is_sending_messages:   true,
    })
    .select('id')
    .single();

  if (insertError || !channel) {
    console.error('[conexoes/create] db insert error:', insertError);
    return NextResponse.json({ error: 'Erro ao registrar canal.' }, { status: 500 });
  }

  // Busca QR code
  try {
    const qr = await connectInstance(instanceName);
    return NextResponse.json({
      channelId:        channel.id,
      instanceName,
      base64:           qr.base64,
      pairingCode:      qr.pairingCode ?? null,
      connectionStatus: 'connecting',
    });
  } catch (err) {
    console.error('[conexoes/create] qr error:', err);
    return NextResponse.json({
      channelId:        channel.id,
      instanceName,
      base64:           null,
      pairingCode:      null,
      connectionStatus: 'connecting',
      warning:          'Canal criado mas QR code falhou. Use "Conectar número" no card.',
    });
  }
}

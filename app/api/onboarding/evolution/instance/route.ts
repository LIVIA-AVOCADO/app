import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/queries/onboarding';
import { configureInstanceWebhook, configureInstanceSettings, fetchInstanceId } from '@/lib/evolution/client';

const EVOLUTION_BASE = process.env.EVOLUTION_API_BASE_URL!;
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY!;

/**
 * POST /api/onboarding/evolution/instance
 * Cria uma instância WhatsApp na Evolution API e registra no payload da sessão.
 *
 * O channel_provider_id é lido de public.niche_channel_defaults vinculado ao
 * nicho do template da sessão — sem hardcode.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.sessionId) {
    return NextResponse.json({ error: 'sessionId obrigatório' }, { status: 400 });
  }

  const { sessionId } = body as { sessionId: string };
  const instanceName = `livia-${sessionId.slice(0, 8)}`;

  // Busca o provider padrão para o nicho do template desta sessão
  const session = await getSession(sessionId, user.id);
  if (!session) {
    return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
  }

  const nicho = session.template as unknown as Record<string, unknown>;
  const nicheId = nicho.niche_id as string | null;

  const adminClient = createAdminClient();

  // Lê o channel_provider_id de niche_channel_defaults para WhatsApp
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: defaults } = await (adminClient.from as any)('niche_channel_defaults')
    .select('channel_provider_id')
    .eq('niche_id', nicheId ?? '')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const providerId: string | null = defaults?.channel_provider_id ?? null;

  if (!providerId) {
    console.error('[evolution/instance] niche_channel_defaults não encontrado para niche_id:', nicheId);
    return NextResponse.json(
      { error: 'Configuração de canal não encontrada para este nicho.' },
      { status: 422 }
    );
  }

  try {
    const res = await fetch(`${EVOLUTION_BASE}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_KEY,
      },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });

    // 403 = instância já existe → reutiliza
    if (!res.ok && res.status !== 403) {
      const text = await res.text();
      console.error('[evolution/instance] create error:', res.status, text);
      return NextResponse.json({ error: 'Erro ao criar instância Evolution.' }, { status: 502 });
    }

    // Busca UUID da instância + aplica configurações em paralelo
    const [instanceId] = await Promise.all([
      fetchInstanceId(instanceName),
      configureInstanceWebhook(instanceName),
      configureInstanceSettings(instanceName),
    ]);

    // Salva no payload da sessão (step 'channel')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.rpc as any)('onboarding_save_step', {
      p_session_id:   sessionId,
      p_step_key:     'channel',
      p_step_payload: {
        provider_id:         providerId,
        external_channel_id: instanceName,
        instance_id:         instanceId ?? null,
        connection_status:   'pending',
      },
      p_user_id:      user.id,
    });

    return NextResponse.json({ instanceName });
  } catch (err) {
    console.error('[evolution/instance] error:', err);
    return NextResponse.json({ error: 'Erro de conexão.' }, { status: 500 });
  }
}

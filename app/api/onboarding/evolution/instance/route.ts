import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const EVOLUTION_BASE = process.env.EVOLUTION_API_BASE_URL!;
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY!;

/**
 * POST /api/onboarding/evolution/instance
 * Cria uma instância WhatsApp na Evolution API e registra no payload da sessão.
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

    if (!res.ok && res.status !== 403) {
      const text = await res.text();
      console.error('[evolution/instance] create error:', res.status, text);
      return NextResponse.json({ error: 'Erro ao criar instância Evolution.' }, { status: 502 });
    }

    // Salva instanceName + provider_id no payload da sessão (step 'channel')
    // provider_id = Evolution API 2.3.6 (channel_providers.id no banco)
    const adminClient = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.rpc as any)('onboarding_save_step', {
      p_session_id:   sessionId,
      p_step_key:     'channel',
      p_step_payload: {
        provider_id:         '076b2291-d532-41b0-8b41-a2f721e22ea5',
        external_channel_id: instanceName,
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

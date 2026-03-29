import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const EVOLUTION_BASE = process.env.EVOLUTION_API_BASE_URL!;
const EVOLUTION_KEY  = process.env.EVOLUTION_API_KEY!;

interface RouteContext {
  params: Promise<{ instanceName: string }>;
}

/**
 * GET /api/onboarding/evolution/status/[instanceName]?sessionId=xxx
 * Verifica o estado de conexão da instância na Evolution API.
 * Quando conectado (state === 'open'), atualiza o payload da sessão.
 * Retorna { state: 'open' | 'close' | 'connecting' }.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { instanceName } = await params;
  const sessionId = request.nextUrl.searchParams.get('sessionId');

  try {
    const res = await fetch(`${EVOLUTION_BASE}/instance/connectionState/${instanceName}`, {
      headers: { 'apikey': EVOLUTION_KEY },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[evolution/status] error:', res.status, text);
      return NextResponse.json({ error: 'Erro ao verificar status.' }, { status: 502 });
    }

    const data = await res.json() as { instance?: { state?: string }; state?: string };
    const state = data?.instance?.state ?? data?.state ?? 'close';

    // Quando conectado, atualiza o step 'channel' na sessão
    if (state === 'open' && sessionId) {
      const adminClient = createAdminClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminClient.rpc as any)('onboarding_save_step', {
        p_session_id:   sessionId,
        p_step_key:     'channel',
        p_step_payload: {
          provider_id:         '076b2291-d532-41b0-8b41-a2f721e22ea5',
          external_channel_id: instanceName,
          connection_status:   'connected',
        },
        p_user_id:      user.id,
      });
    }

    return NextResponse.json({ state });
  } catch (err) {
    console.error('[evolution/status] error:', err);
    return NextResponse.json({ error: 'Erro de conexão.' }, { status: 500 });
  }
}

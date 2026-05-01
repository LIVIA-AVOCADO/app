import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const GATEWAY_URL     = process.env.GATEWAY_URL; // https://livia-gw...
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const { conversationId, tenantId } = await request.json();
    if (!conversationId || !tenantId) {
      return NextResponse.json({ error: 'conversationId e tenantId são obrigatórios' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Busca conversa + contato em paralelo com resolução do canal
    const { data: conversation } = await supabase
      .from('conversations')
      .select('channel_id, contact_id')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (!conversation?.channel_id || !conversation?.contact_id) {
      return NextResponse.json({ ok: false });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [channelRes, contactRes] = await Promise.all([
      (createAdminClient() as any)
        .from('channels')
        .select('config_json')
        .eq('id', conversation.channel_id)
        .single(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from('contacts')
        .select('external_identification_contact, phone')
        .eq('id', conversation.contact_id)
        .single(),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = channelRes.data?.config_json as Record<string, any> | null;
    const evolutionBaseUrl = cfg?.evolution_api_url ?? '';
    const evolutionApiKey  = cfg?.evolution_api_key ?? cfg?.instance_id_api ?? '';
    const instanceName     = cfg?.instance_name ?? '';

    if (!evolutionBaseUrl || !instanceName || !GATEWAY_URL) {
      return NextResponse.json({ ok: false });
    }

    const contact = contactRes.data;
    const number  = contact?.external_identification_contact ?? contact?.phone ?? '';
    if (!number) return NextResponse.json({ ok: false });

    const presenceUrl = `${GATEWAY_URL}/presence`;

    // Fire-and-forget — não aguarda resposta para não bloquear o cliente
    fetch(presenceUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${GATEWAY_API_KEY ?? ''}`,
      },
      body: JSON.stringify({
        evolutionBaseUrl,
        evolutionApiKey,
        instanceName,
        number,
        presence: 'composing',
        delay:    5000,
      }),
    }).catch(() => { /* best-effort */ });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/onboarding/chat
 * Proxy seguro para o agente de onboarding no n8n.
 * A chave da API fica apenas no servidor — nunca exposta ao browser.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.message || !body?.sessionId) {
    return NextResponse.json({ error: 'message e sessionId são obrigatórios' }, { status: 400 });
  }

  const n8nUrl    = process.env.N8N_BASE_URL! + process.env.N8N_ONBOARDING_CHAT_WEBHOOK!;
  const apiKey    = process.env.N8N_ONBOARDING_CHAT_API_KEY!;

  const payload = {
    session_id: body.sessionId,
    message:    body.message,
    user: {
      id:    user.id,
      name:  body.userName  ?? '',
      email: user.email     ?? '',
    },
    company: {
      name:           body.company?.name           ?? '',
      niche:          body.company?.niche          ?? '',
      employee_count: body.company?.employee_count ?? '',
      website:        body.company?.website        ?? '',
    },
  };

  try {
    const n8nRes = await fetch(n8nUrl, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const rawText = await n8nRes.text();
    console.log('[onboarding/chat] n8n status:', n8nRes.status, '| body:', rawText);

    let data: Record<string, unknown> = {};
    try { data = JSON.parse(rawText); } catch { /* resposta não-JSON */ }

    if (!n8nRes.ok) {
      return NextResponse.json(
        { error: `n8n ${n8nRes.status}`, detail: rawText },
        { status: 502 }
      );
    }

    return NextResponse.json({ reply: data.reply ?? data.output ?? data.text ?? data.message ?? rawText });
  } catch (err) {
    console.error('[onboarding/chat] fetch error:', err);
    return NextResponse.json({ error: 'Erro de conexão.' }, { status: 500 });
  }
}

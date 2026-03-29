import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/onboarding/chat
 * Diagnóstico: testa conexão com n8n sem precisar de auth do usuário.
 */
export async function GET() {
  const n8nUrl = process.env.N8N_BASE_URL! + process.env.N8N_ONBOARDING_CHAT_WEBHOOK!;

  try {
    const res = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: 'diagnostico',
        message: 'ping',
        user_id: 'diagnostico',
        user_name: 'Diagnóstico',
        user_email: 'diagnostico@teste.com',
        company_name: 'Diagnóstico',
        company_niche: 'tecnologia',
        company_employees: '1',
        company_website: '',
      }),
    });

    const rawText = await res.text();

    return NextResponse.json({
      n8n_url:    n8nUrl,
      env_ok:     !!process.env.N8N_BASE_URL && !!process.env.N8N_ONBOARDING_CHAT_WEBHOOK,
      http_status: res.status,
      body:        rawText || '(vazio)',
    });
  } catch (err) {
    return NextResponse.json({ error: String(err), n8n_url: n8nUrl });
  }
}

/**
 * POST /api/onboarding/chat
 * Proxy seguro para o agente de onboarding no n8n.
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

  const n8nUrl = process.env.N8N_BASE_URL! + process.env.N8N_ONBOARDING_CHAT_WEBHOOK!;

  // Payload flat — mais fácil de acessar no n8n como {{ $json.campo }}
  const payload = {
    session_id:        body.sessionId,
    message:           body.message,
    user_id:           user.id,
    user_name:         body.userName          ?? '',
    user_email:        user.email             ?? '',
    company_name:      body.company?.name     ?? '',
    company_niche:     body.company?.niche    ?? '',
    company_employees: body.company?.employee_count ?? '',
    company_website:   body.company?.website  ?? '',
  };

  console.log('[onboarding/chat] payload →', JSON.stringify(payload));

  try {
    const n8nRes = await fetch(n8nUrl, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.N8N_ONBOARDING_CHAT_API_KEY!,
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

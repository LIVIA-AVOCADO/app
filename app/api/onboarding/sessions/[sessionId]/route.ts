import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSession } from '@/lib/queries/onboarding';
import { saveStepSchema } from '@/lib/validations/onboarding-validation';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/onboarding/sessions/[sessionId]
 * Retorna a sessão com o template aninhado
 */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;

  const session = await getSession(sessionId, user.id);

  if (!session) {
    return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
  }

  return NextResponse.json({ data: session });
}

/**
 * PATCH /api/onboarding/sessions/[sessionId]
 * Salva um bloco do payload.
 * Chama RPC onboarding.save_step(session_id, step_key, step_payload, user_id)
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
  }

  const parsed = saveStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { sessionId } = await params;
  const { stepKey, stepPayload } = parsed.data;

  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc(
    'onboarding_save_step' as never,
    {
      p_session_id:   sessionId,
      p_step_key:     stepKey,
      p_step_payload: stepPayload,
      p_user_id:      user.id,
    } as never
  );

  if (error) {
    console.error('[onboarding] save_step RPC error:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar etapa.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

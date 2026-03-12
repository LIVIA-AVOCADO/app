import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSessionSchema } from '@/lib/validations/onboarding-validation';

/**
 * POST /api/onboarding/sessions
 * Cria uma nova sessão de onboarding a partir de um template.
 * Chama RPC onboarding.create_session(template_id, user_id)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
  }

  const parsed = createSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Dados inválidos' },
      { status: 400 }
    );
  }

  const { templateId } = parsed.data;

  // Usar adminClient para chamar a RPC (SECURITY DEFINER no schema onboarding)
  const adminClient = createAdminClient();

  const { data, error } = await adminClient.rpc(
    'create_session' as never,
    { p_template_id: templateId, p_created_by: user.id } as never
  );

  if (error) {
    console.error('[onboarding] create_session RPC error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar sessão de onboarding.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

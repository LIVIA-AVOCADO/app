import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RouteContext {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/onboarding/activate/[sessionId]
 * Ativa a sessão de onboarding: cria tenant, agente, base, tags etc.
 * Chama RPC public.onboarding_activate_session (SECURITY DEFINER)
 */
export async function POST(_request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId } = await params;

  const { data, error } = await (createAdminClient().rpc as never as (
    fn: string, args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: unknown }>)(
    'onboarding_activate_session',
    { p_session_id: sessionId, p_user_id: user.id }
  );

  if (error) {
    const err = error as { message?: string };
    console.error('[onboarding] activate_session error:', err);
    return NextResponse.json(
      { error: err.message ?? 'Erro ao ativar workspace.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ data });
}

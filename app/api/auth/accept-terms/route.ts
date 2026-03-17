import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  // Usa admin client para bypasear RLS e gravar o aceite
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('users')
    .update({ terms_accepted_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    console.error('[accept-terms] Erro ao gravar aceite:', error);
    return NextResponse.json({ error: 'Erro ao registrar aceite.', detail: error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

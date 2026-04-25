import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/teams/users?tenantId=xxx
// Retorna usuários do tenant com acesso ao inbox (módulo livechat),
// incluindo nome, avatar e status de disponibilidade.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId');
  if (!tenantId) return NextResponse.json({ error: 'tenantId obrigatório' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('users')
    .select('id, full_name, avatar_url, availability_status')
    .eq('tenant_id', tenantId)
    .eq('is_internal', false)
    .contains('modules', ['livechat'])
    .order('full_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: data ?? [] });
}

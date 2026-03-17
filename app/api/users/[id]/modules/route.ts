import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSuperAdmin } from '@/lib/permissions';

/**
 * PATCH /api/users/[id]/modules
 * Atualiza os módulos de um usuário existente no mesmo tenant.
 * Restrito a super_admin.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;

  let body: { modules?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { modules } = body;
  if (!Array.isArray(modules)) {
    return NextResponse.json({ error: 'modules deve ser um array' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  // Verifica se o solicitante é super_admin com tenant
  const { data: adminUser } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single();

  if (!adminUser?.tenant_id || !isSuperAdmin(adminUser.role ?? '')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const adminClient = createAdminClient();

  // Verifica se o usuário alvo pertence ao mesmo tenant
  const { data: targetUser } = await adminClient
    .from('users')
    .select('id, tenant_id')
    .eq('id', targetUserId)
    .single();

  if (!targetUser) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
  }

  if (targetUser.tenant_id !== adminUser.tenant_id) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: updated, error } = await (adminClient as any)
    .from('users')
    .update({ modules })
    .eq('id', targetUserId)
    .select('id, full_name, modules')
    .single();

  if (error) {
    console.error('[PATCH /api/users/[id]/modules]', error);
    return NextResponse.json({ error: 'Erro ao atualizar módulos' }, { status: 500 });
  }

  return NextResponse.json({ user: updated });
}

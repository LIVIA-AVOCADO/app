import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSuperAdmin, hasModule, MODULE_KEYS } from '@/lib/permissions';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code')?.trim().toUpperCase();

  if (!code || code.length < 4) {
    return NextResponse.json(
      { error: 'Código inválido' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: adminUser } = await supabase
    .from('users')
    .select('tenant_id, role, modules')
    .eq('id', user.id)
    .single();

  const canManage =
    adminUser?.tenant_id &&
    (isSuperAdmin(adminUser.role ?? '') ||
      hasModule(adminUser.modules ?? [], MODULE_KEYS.GERENCIAR_USUARIOS));

  if (!canManage) {
    return NextResponse.json(
      { error: 'Acesso negado' },
      { status: 403 }
    );
  }

  const adminClient = createAdminClient();

  const { data: foundUser, error } = await adminClient
    .from('users')
    .select('id, full_name, email, avatar_url')
    .eq('invite_code', code)
    .is('tenant_id', null)
    .single();

  if (error || !foundUser) {
    return NextResponse.json(
      { error: 'Nenhum usuário encontrado com este código' },
      { status: 404 }
    );
  }

  return NextResponse.json({ user: foundUser });
}

export async function POST(request: Request) {
  let body: { userId?: string; modules?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 });
  }

  const { userId, modules = [] } = body;

  if (!userId) {
    return NextResponse.json(
      { error: 'userId é obrigatório' },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: adminUser } = await supabase
    .from('users')
    .select('tenant_id, role, modules')
    .eq('id', user.id)
    .single();

  const canManage =
    adminUser?.tenant_id &&
    (isSuperAdmin(adminUser.role ?? '') ||
      hasModule(adminUser.modules ?? [], MODULE_KEYS.GERENCIAR_USUARIOS));

  if (!canManage) {
    return NextResponse.json(
      { error: 'Acesso negado' },
      { status: 403 }
    );
  }

  const adminClient = createAdminClient();

  const { data: targetUser } = await adminClient
    .from('users')
    .select('id, tenant_id')
    .eq('id', userId)
    .single();

  if (!targetUser) {
    return NextResponse.json(
      { error: 'Usuário não encontrado' },
      { status: 404 }
    );
  }

  if (targetUser.tenant_id) {
    return NextResponse.json(
      { error: 'Usuário já está associado a um tenant' },
      { status: 409 }
    );
  }

  const { data: updatedUser, error: updateError } = await adminClient
    .from('users')
    .update({
      tenant_id: adminUser.tenant_id,
      role: 'user',
      modules,
      invite_code: null,
    })
    .eq('id', userId)
    .select('id, full_name, email, tenant_id, modules')
    .single();

  if (updateError) {
    console.error('Error associating user:', updateError);
    return NextResponse.json(
      { error: 'Erro ao associar usuário' },
      { status: 500 }
    );
  }

  return NextResponse.json({ user: updatedUser });
}

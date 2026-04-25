'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Server Action para fazer login
 */
export async function login(email: string, password: string) {
  const supabase = await createClient();

  // Validações básicas
  if (!email || !password) {
    return { error: 'Email e senha são obrigatórios' };
  }

  // Tenta fazer login
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Login error:', error);
    return {
      error: error.message === 'Invalid login credentials'
        ? 'Email ou senha inválidos'
        : 'Erro ao fazer login. Tente novamente.'
    };
  }

  if (!data.user) {
    return { error: 'Erro ao autenticar usuário' };
  }

  // Verificar se usuário existe na tabela users
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id, tenant_id, full_name')
    .eq('id', data.user.id)
    .single();

  if (userError || !userData) {
    console.error('User data error:', userError);
    // Usuário existe no auth mas não na tabela users
    // Fazer logout e retornar erro
    await supabase.auth.signOut();
    return { error: 'Usuário não encontrado no sistema' };
  }

  // Revalidar cache
  revalidatePath('/', 'layout');

  // Retornar sucesso - o componente cliente fará o redirecionamento
  return { success: true };
}

/**
 * Server Action para fazer logout
 */
export async function logout() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('users')
      .update({ availability_status: 'offline', availability_updated_at: new Date().toISOString() })
      .eq('id', user.id);
  }

  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/login');
}

/**
 * Server Action para verificar se usuário está autenticado
 */
export async function getAuthUser() {
  const supabase = await createClient();

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Buscar dados do usuário na tabela
  const { data: userData } = await supabase
    .from('users')
    .select('id, tenant_id, full_name, email, avatar_url')
    .eq('id', user.id)
    .single();

  return userData;
}

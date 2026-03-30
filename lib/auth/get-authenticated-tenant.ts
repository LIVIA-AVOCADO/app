/**
 * lib/auth/get-authenticated-tenant.ts
 *
 * Helper para API routes: autentica o usuário e retorna tenant_id.
 * Retorna null se não autenticado ou sem tenant.
 */

import { createClient } from '@/lib/supabase/server';

export interface AuthenticatedTenant {
  userId: string;
  tenantId: string;
  modules: string[];
  role: string;
}

export async function getAuthenticatedTenant(): Promise<AuthenticatedTenant | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id, modules, role')
    .eq('id', user.id)
    .single();

  if (!userData?.tenant_id) return null;

  return {
    userId:   user.id,
    tenantId: userData.tenant_id as string,
    modules:  (userData.modules as string[]) ?? [],
    role:     (userData.role as string) ?? 'user',
  };
}

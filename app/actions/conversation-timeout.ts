'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { upsertConversationTimeoutSettings } from '@/lib/queries/conversation-timeout';
import {
  upsertConversationTimeoutSchema,
  type UpsertConversationTimeoutInput,
} from '@/lib/validations/conversation-timeout-validation';

export async function upsertConversationTimeoutAction(
  userId: string,
  tenantId: string,
  data: UpsertConversationTimeoutInput
) {
  const supabase = await createClient();

  try {
    // 1. Verifica autenticação
    const { data: authData } = await supabase.auth.getUser();

    if (!authData.user || authData.user.id !== userId) {
      return { success: false, error: 'Não autorizado' };
    }

    // 2. Busca tenant do usuário
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      console.error('[upsertConversationTimeoutAction] Error fetching user:', userError);
      return { success: false, error: 'Usuário não encontrado' };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userTenantId = (userData as any).tenant_id;

    if (!userTenantId) {
      return { success: false, error: 'Usuário não associado a nenhum tenant' };
    }

    // 3. Valida que o usuário pertence ao tenant solicitado
    if (userTenantId !== tenantId) {
      console.error(
        `[upsertConversationTimeoutAction] User ${userId.slice(0, 8)} tried to modify tenant ${tenantId.slice(0, 8)} but belongs to ${userTenantId.slice(0, 8)}`
      );
      return { success: false, error: 'Usuário não autorizado para este tenant' };
    }

    // 4. Valida payload com Zod
    const parsed = upsertConversationTimeoutSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
    }

    // 5. Upsert
    const result = await upsertConversationTimeoutSettings({
      tenant_id: tenantId,
      is_active: parsed.data.is_active,
      ia_inactive_timeout_minutes: parsed.data.ia_inactive_timeout_minutes ?? null,
      closure_message: parsed.data.closure_message ?? null,
    });

    revalidatePath('/configuracoes/encerramento-automatico');

    return { success: true, data: result };
  } catch (error) {
    console.error('[upsertConversationTimeoutAction] Unexpected error:', error);
    return { success: false, error: 'Erro interno ao processar solicitação' };
  }
}

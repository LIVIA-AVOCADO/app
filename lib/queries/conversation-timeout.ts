/**
 * Queries para tenant_conversation_timeout_settings
 *
 * NOTA: Tabela não está em types/database.ts — usa `(supabase as any)`.
 */

import { createClient } from '@/lib/supabase/server';
import type { ConversationTimeoutSettings } from '@/lib/validations/conversation-timeout-validation';

export type { ConversationTimeoutSettings };

export async function getConversationTimeoutSettings(
  tenantId: string
): Promise<ConversationTimeoutSettings | null> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('tenant_conversation_timeout_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    // PGRST116 = no rows found (registro ainda não existe para o tenant)
    if (error.code === 'PGRST116') return null;
    console.error('[getConversationTimeoutSettings] Error:', error);
    throw error;
  }

  return data as ConversationTimeoutSettings;
}

export async function upsertConversationTimeoutSettings(payload: {
  tenant_id: string;
  is_active: boolean;
  ia_inactive_timeout_minutes: number | null;
  closure_message: string | null;
}): Promise<ConversationTimeoutSettings> {
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('tenant_conversation_timeout_settings')
    .upsert(
      { ...payload, updated_at: new Date().toISOString() },
      { onConflict: 'tenant_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[upsertConversationTimeoutSettings] Error:', error);
    throw error;
  }

  return data as ConversationTimeoutSettings;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PipelineStage, ConversationWithPipelineAndContact } from '@/types/crm';

export async function getPipelineStages(tenantId: string): Promise<PipelineStage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pipeline_stages' as any)
    .select('*')
    .eq('tenant_id', tenantId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching pipeline stages:', error);
    return [];
  }
  return (data || []) as unknown as PipelineStage[];
}

export async function getConversationsForPipeline(
  tenantId: string
): Promise<ConversationWithPipelineAndContact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      *,
      contact:contacts!inner(*)
    `)
    .eq('tenant_id', tenantId)
    .neq('status', 'closed')
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('Error fetching pipeline conversations:', error);
    return [];
  }
  return (data as any) as ConversationWithPipelineAndContact[];
}

export async function moveConversationToStage(
  conversationId: string,
  tenantId: string,
  toStageId: string | null,
  userId: string
): Promise<boolean> {
  const admin = createAdminClient();

  // Fetch current stage
  const { data: conv } = await admin
    .from('conversations')
    .select('pipeline_stage_id')
    .eq('id', conversationId)
    .eq('tenant_id', tenantId)
    .single();

  const fromStageId = (conv as any)?.pipeline_stage_id ?? null;

  // Update conversation
  const { error: updateErr } = await admin
    .from('conversations')
    .update({
      pipeline_stage_id: toStageId,
      stage_moved_at: new Date().toISOString(),
    } as any)
    .eq('id', conversationId)
    .eq('tenant_id', tenantId);

  if (updateErr) {
    console.error('Error moving conversation:', updateErr);
    return false;
  }

  // Record history
  await admin
    .from('pipeline_stage_history' as any)
    .insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      from_stage_id: fromStageId,
      to_stage_id: toStageId,
      moved_by: userId,
    });

  return true;
}

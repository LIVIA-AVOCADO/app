/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from '@/lib/supabase/admin';

export interface CRMMetricsSummary {
  totalContacts: number;
  activeConversations: number;
  closedLast30d: number;
  iaHandled: number;
  humanHandled: number;
  pipelineByStage: Array<{ name: string; color: string; count: number; dealValue: number }>;
  contactsLast30d: number;
  messagesLast7d: number;
}

export async function getCRMMetrics(tenantId: string): Promise<CRMMetricsSummary> {
  const admin = createAdminClient();
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const d7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();

  const [
    contactsTotal,
    activeConvs,
    closedRecent,
    messagesRecent,
    contactsRecent,
    pipeline,
  ] = await Promise.all([
    // Total contacts
    admin.from('contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    // Active conversations
    admin.from('conversations').select('id, ia_active', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'open'),
    // Closed last 30d
    admin.from('conversations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'closed').gte('updated_at', d30),
    // Messages last 7d (via conversations join)
    admin.from('messages').select('id, conversations!inner(tenant_id)', { count: 'exact', head: true })
      .eq('conversations.tenant_id' as any, tenantId)
      .gte('created_at', d7),
    // New contacts last 30d
    admin.from('contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).gte('created_at', d30),
    // Pipeline stages with conversation counts
    (admin as any).from('pipeline_stages').select('id, name, color').eq('tenant_id', tenantId).order('display_order'),
  ]);

  const stagesData: Array<{ id: string; name: string; color: string }> = pipeline.data || [];

  // Fetch conversation counts per stage
  const pipelineByStage = await Promise.all(
    stagesData.map(async (stage) => {
      const { data: convs } = await admin
        .from('conversations')
        .select('id, deal_value')
        .eq('tenant_id', tenantId)
        .eq('pipeline_stage_id' as any, stage.id)
        .eq('status', 'open');

      const count = convs?.length ?? 0;
      const dealValue = (convs || []).reduce((sum: number, c: any) => sum + (c.deal_value ?? 0), 0);
      return { name: stage.name, color: stage.color, count, dealValue };
    })
  );

  const activeConvsData: Array<{ ia_active: boolean }> = (activeConvs.data || []);
  const iaHandled = activeConvsData.filter((c) => c.ia_active).length;
  const humanHandled = activeConvsData.filter((c) => !c.ia_active).length;

  return {
    totalContacts: contactsTotal.count ?? 0,
    activeConversations: activeConvs.count ?? 0,
    closedLast30d: closedRecent.count ?? 0,
    iaHandled,
    humanHandled,
    pipelineByStage,
    contactsLast30d: contactsRecent.count ?? 0,
    messagesLast7d: messagesRecent.count ?? 0,
  };
}

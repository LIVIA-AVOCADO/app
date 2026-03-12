/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CRM Queries - Funções de busca para o CRM Kanban
 *
 * IMPORTANTE: Todas as queries validam tenant_id para multi-tenancy
 *
 * Princípios SOLID:
 * - Single Responsibility: Cada função tem uma responsabilidade específica
 * - Dependency Inversion: Usa abstração do Supabase client
 *
 * NOTE: Usa @ts-expect-error porque tabela 'tags' não está nos tipos gerados
 */

import { createClient } from '@/lib/supabase/server';
import type { Tag, ConversationStatus } from '@/types/database-helpers';
import type { ConversationWithTagsAndContact } from '@/types/crm';

/**
 * Busca tags ativas do tenant ordenadas por order_index
 *
 * @param tenantId - ID do tenant (OBRIGATÓRIO para multi-tenancy)
 * @returns Lista de tags ativas ordenadas
 */
export async function getTags(tenantId: string): Promise<Tag[]> {
  const supabase = await createClient();

   
  const { data, error } = await (supabase as any)
    .from('tags')
    .select('*')
    .eq('id_tenant', tenantId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('Error fetching tags:', error);
    return [];
  }

  return (data || []) as Tag[];
}

/**
 * Busca todas as tags do tenant (incluindo inativas)
 * Útil para renderizar colunas vazias com indicador "Inativa"
 *
 * @param tenantId - ID do tenant
 * @returns Lista de todas as tags ordenadas
 */
export async function getAllTags(tenantId: string): Promise<Tag[]> {
  const supabase = await createClient();

   
  const { data, error } = await (supabase as any)
    .from('tags')
    .select('*')
    .eq('id_tenant', tenantId)
    .order('order_index', { ascending: true});

  if (error) {
    console.error('Error fetching all tags:', error);
    return [];
  }

  return (data || []) as Tag[];
}

/**
 * Busca conversas com suas tags e informações do contato
 *
 * Query otimizada com relacionamentos:
 * - conversations → contact (1:1)
 * - conversations → conversation_tags → tags (many-to-many)
 *
 * @param tenantId - ID do tenant (OBRIGATÓRIO para multi-tenancy)
 * @param status - Filtro opcional por status da conversa
 * @returns Lista de conversas com tags e contato
 */
export async function getConversationsWithTags(
  tenantId: string,
  status?: ConversationStatus
): Promise<ConversationWithTagsAndContact[]> {
  const supabase = await createClient();

  let query = supabase
    .from('conversations')
    .select(`
      *,
      contact:contacts!inner(*),
      conversation_tags(
        tag:tags(*)
      )
    `)
    .eq('tenant_id', tenantId)
    .order('last_message_at', { ascending: false });

  // Aplicar filtro de status se fornecido
  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching conversations with tags:', error);
    return [];
  }

  return (data as any) as ConversationWithTagsAndContact[];
}

/**
 * Busca contadores de conversas por status
 * Útil para exibir nos badges de filtro
 *
 * @param tenantId - ID do tenant
 * @returns Objeto com contadores por status
 */
export async function getConversationStatusCounts(
  tenantId: string
): Promise<{
  open: number;
  closed: number;
  all: number;
}> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('conversations')
    .select('status')
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('Error fetching conversation counts:', error);
    return { open: 0, closed: 0, all: 0 };
  }

  const counts = {
    open: 0,
    closed: 0,
    all: data.length,
  };

  data.forEach((conv: any) => {
    if (conv.status === 'open') counts.open++;
    else if (conv.status === 'closed') counts.closed++;
  });

  return counts;
}

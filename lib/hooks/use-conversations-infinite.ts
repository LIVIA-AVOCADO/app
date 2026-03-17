'use client';

/**
 * Hook: useConversationsInfinite
 *
 * Implementa infinite scroll para a lista de conversas usando React Query
 *
 * Features:
 * - Paginação automática (50 itens por página)
 * - Cache inteligente com React Query
 * - Suporte a filtros (status, search, tags)
 * - Auto-fetch na próxima página
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { ConversationWithContact } from '@/types/livechat';

interface RawTag {
  id: string;
  tag_name: string;
  color: string | null;
  is_category: boolean;
  order_index: number | null;
  active: boolean;
  created_at: string;
  id_neurocore: string | null;
  prompt_to_ai: string | null;
}

interface RawConversationTag {
  id: string;
  tag_id: string;
  tag: RawTag | null;
}

interface RawConversation {
  conversation_tags: RawConversationTag[] | null;
  contacts: Record<string, unknown>;
  [key: string]: unknown;
}

const PAGE_SIZE = 50;

interface ConversationFilters {
  includeClosedConversations?: boolean;
  statusFilter?: 'ia' | 'manual' | 'closed' | 'all';
  searchQuery?: string;
  selectedTagIds?: Set<string>;
}

export function useConversationsInfinite(
  tenantId: string,
  filters?: ConversationFilters
) {
  const supabase = createClient();

  return useInfiniteQuery({
    queryKey: ['conversations-infinite', tenantId, filters],
    queryFn: async ({ pageParam = 0 }) => {
      // Base query com JOIN de contacts e tags
      let query = supabase
        .from('conversations')
        .select(`
          *,
          contacts!inner(*),
          conversation_tags(
            id,
            tag_id,
            tag:tags(
              id,
              tag_name,
              color,
              is_category,
              order_index,
              active,
              created_at,
              id_neurocore,
              prompt_to_ai
            )
          )
        `)
        .eq('tenant_id', tenantId)
        .order('last_message_at', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      // Aplicar filtros de status
      if (filters?.statusFilter === 'ia') {
        query = query.eq('ia_active', true).neq('status', 'closed');
      } else if (filters?.statusFilter === 'manual') {
        query = query.eq('ia_active', false).neq('status', 'closed');
      } else if (filters?.statusFilter === 'closed') {
        query = query.eq('status', 'closed');
      } else if (!filters?.includeClosedConversations) {
        query = query.neq('status', 'closed');
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('[use-conversations-infinite] Error fetching:', error);
        throw error;
      }

      // Transform data to ConversationWithContact format
      const conversations = (data as RawConversation[] || []).map((conv) => {
        const tags = (conv.conversation_tags || []).map((ct: RawConversationTag) => ({
          ...ct,
          tag: ct.tag,
        }));

        // Find category (is_category = true, sorted by order_index)
        const category = tags
          .map((ct: RawConversationTag) => ct.tag)
          .filter((tag): tag is RawTag => tag !== null && tag.is_category)
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))[0] || null;

        return {
          ...conv,
          contact: conv.contacts,
          lastMessage: null, // Will be populated by realtime
          conversation_tags: tags,
          category,
        } as unknown as ConversationWithContact;
      });

      // Client-side filtering for search and tags
      let filtered = conversations;

      // Search filter
      if (filters?.searchQuery) {
        const searchLower = filters.searchQuery.toLowerCase();
        filtered = filtered.filter((conv) => {
          const name = conv.contact?.name || '';
          const phone = conv.contact?.phone || '';
          return (
            name.toLowerCase().includes(searchLower) ||
            phone.includes(searchLower)
          );
        });
      }

      // Tags filter
      if (filters?.selectedTagIds && filters.selectedTagIds.size > 0) {
        filtered = filtered.filter((conv) =>
          conv.conversation_tags?.some((ct) =>
            ct.tag && filters.selectedTagIds?.has(ct.tag.id)
          )
        );
      }

      return filtered;
    },
    getNextPageParam: (lastPage, allPages) => {
      // Se a última página tem menos que PAGE_SIZE, não há mais páginas
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    initialPageParam: 0,
    staleTime: 30000, // 30 segundos - dados considerados frescos
    gcTime: 5 * 60 * 1000, // 5 minutos - tempo antes de garbage collection
  });
}


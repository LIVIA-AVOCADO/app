'use client';

/**
 * ContactList com Virtualização
 *
 * Features:
 * - Infinite scroll automático
 * - Virtualização (renderiza apenas ~20 itens visíveis)
 * - Integração com realtime
 * - Suporta milhares de conversas sem lag
 */

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ContactItem } from './contact-item';
import { TagSelector } from '@/components/tags/tag-selector';
import { Search, Loader2 } from 'lucide-react';
import { useConversationsInfinite } from '@/lib/hooks/use-conversations-infinite';
import { useRealtimeConversations } from '@/lib/hooks/use-realtime-conversations';
import type { Tag } from '@/types/database-helpers';

interface ContactListVirtualizedProps {
  selectedConversationId?: string;
  tenantId: string;
  onConversationClick?: (conversationId: string) => void;
  allTags: Tag[];
}

export function ContactListVirtualized({
  selectedConversationId,
  tenantId,
  onConversationClick,
  allTags,
}: ContactListVirtualizedProps) {
  const router = useRouter();
  const parentRef = useRef<HTMLDivElement>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ia' | 'manual' | 'closed' | 'all'
  >('ia');
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  // Infinite query para paginação
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    isLoading,
  } = useConversationsInfinite(tenantId, {
    statusFilter,
    searchQuery,
    selectedTagIds,
  });

  // Flatten das páginas
  const conversations = data?.pages.flat() ?? [];

  // Realtime updates - passa conversas atuais como inicial
  const { conversations: liveConversations } = useRealtimeConversations(
    tenantId,
    conversations
  );

  // Use live conversations que são atualizadas em tempo real
  const displayConversations = liveConversations;

  // Virtualização
  const rowVirtualizer = useVirtualizer({
    count: displayConversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Altura estimada do ContactItem em px
    overscan: 5, // Renderiza 5 extras acima/abaixo para scroll suave
  });

  // Auto-carregar quando chega perto do fim
  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    if (virtualItems.length === 0) return;

    const lastItem = virtualItems[virtualItems.length - 1];

    if (
      lastItem &&
      lastItem.index >= displayConversations.length - 10 && // 10 itens antes do fim
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    virtualItems,
    rowVirtualizer,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    displayConversations.length,
  ]);

  // Contadores de status (baseados em todas as conversas carregadas)
  const statusCounts = {
    all: displayConversations.length,
    ia: displayConversations.filter((c) => c.ia_active && c.status !== 'closed')
      .length,
    manual: displayConversations.filter(
      (c) => !c.ia_active && c.status !== 'closed'
    ).length,
    closed: displayConversations.filter((c) => c.status === 'closed').length,
  };

  // Handler para toggle de tags (modo filtro)
  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  // Converter selectedTagIds para array de Tags para o TagSelector
  const selectedTags = allTags.filter((tag) => selectedTagIds.has(tag.id));

  if (status === 'pending' || isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-4 border-b space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar contato..." disabled className="pl-9" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>Erro ao carregar conversas</p>
            <p className="text-sm">Tente recarregar a página</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={statusFilter === 'ia' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter('ia')}
          >
            IA ({statusCounts.ia})
          </Badge>
          <Badge
            variant={statusFilter === 'manual' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter('manual')}
          >
            Modo Manual ({statusCounts.manual})
          </Badge>
          <Badge
            variant={statusFilter === 'closed' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter('closed')}
          >
            Encerradas ({statusCounts.closed})
          </Badge>
          <Badge
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter('all')}
          >
            Todas ({statusCounts.all})
          </Badge>
        </div>

        {/* Filtro de tags */}
        {allTags.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground mb-2 block">
              Filtrar por Tags:
            </span>
            <TagSelector
              mode="filter"
              selectedTags={selectedTags}
              availableTags={allTags}
              onTagToggle={handleTagToggle}
              placeholder="Filtrar por tags"
              popoverSide="right"
            />
          </div>
        )}
      </div>

      <div ref={parentRef} className="scrollbar-themed flex-1 overflow-y-auto p-4">
        {displayConversations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery
              ? 'Nenhuma conversa encontrada'
              : 'Nenhuma conversa ativa'}
          </div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const conversation = displayConversations[virtualRow.index];
              if (!conversation) return null;

              return (
                <div
                  key={conversation.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '0.5rem', // space-y-2 equivalent
                  }}
                >
                  <ContactItem
                    conversation={conversation}
                    isSelected={conversation.id === selectedConversationId}
                    onClick={() => {
                      if (onConversationClick) {
                        onConversationClick(conversation.id);
                      } else {
                        router.push(`/inbox?conversation=${conversation.id}`);
                      }
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {isFetchingNextPage && (
          <div className="py-4 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground inline-block" />
            <p className="text-sm text-muted-foreground mt-2">
              Carregando mais conversas...
            </p>
          </div>
        )}

        {!hasNextPage && displayConversations.length > 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Todas as conversas foram carregadas
          </div>
        )}
      </div>
    </div>
  );
}


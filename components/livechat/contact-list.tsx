'use client';

import { useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ContactItem } from './contact-item';
import { TagSelector } from '@/components/tags/tag-selector';
import { Search, MessageCircle, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { getContactDisplayName } from '@/lib/utils/contact-helpers';
import { MutedContactsList } from './muted-contacts-list';
import type { ConversationWithContact } from '@/types/livechat';
import type { Tag } from '@/types/database-helpers';

interface ContactListProps {
  conversations: ConversationWithContact[];
  selectedConversationId?: string;
  tenantId: string;
  onConversationClick?: (conversationId: string) => void;
  onConversationHover?: (conversationId: string) => void;
  onConversationUpdate?: (conversationId: string, updates: Partial<ConversationWithContact>) => void;
  allTags: Tag[];
}

export function ContactList({
  conversations,
  selectedConversationId,
  tenantId,
  onConversationClick,
  onConversationHover,
  onConversationUpdate,
  allTags,
}: ContactListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ia' | 'manual' | 'closed' | 'muted'
  >('ia');

  // Debounce de hover: só dispara prefetch após 150ms para evitar falsos positivos
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleHoverEnter = useCallback((conversationId: string) => {
    if (!onConversationHover) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      onConversationHover(conversationId);
    }, 150);
  }, [onConversationHover]);

  const handleHoverLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const handleMarkUnread = useCallback(async (conversationId: string) => {
    fetch('/api/conversations/mark-as-unread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, tenantId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        onConversationUpdate?.(conversationId, { has_unread: true, unread_count: 1 });
        toast.success('Conversa marcada como não lida');
      })
      .catch(() => toast.error('Erro ao marcar como não lida'));
  }, [tenantId, onConversationUpdate]);

  const handleCloseConversation = useCallback(async (conversationId: string) => {
    fetch('/api/conversations/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, tenantId, status: 'closed' }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        onConversationUpdate?.(conversationId, { status: 'closed' });
        toast.success('Conversa encerrada');
      })
      .catch(() => toast.error('Erro ao encerrar conversa'));
  }, [tenantId, onConversationUpdate]);

  const handleCardTagToggle = useCallback((conversationId: string, tagId: string, isRemoving: boolean) => {
    fetch('/api/conversations/update-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        tagId: isRemoving ? null : tagId,
        tagIdToRemove: isRemoving ? tagId : null,
        tenantId,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        toast.success(isRemoving ? 'Tag removida' : 'Tag adicionada');
      })
      .catch(() => toast.error('Erro ao atualizar tag'));
  }, [tenantId]);

  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  // ID da conversa que acabou de ser marcada como lida (mantém visível até clicar em outra)
  const [justReadConversationId, setJustReadConversationId] = useState<string | null>(null);

  // Filtros
  const filteredConversations = conversations.filter((conversation) => {
    const displayName = getContactDisplayName(
      conversation.contact.name,
      conversation.contact.phone
    );
    const matchesSearch = displayName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    // Contatos silenciados nunca aparecem nas abas normais
    if (conversation.contact.is_muted) return false;

    // Lógica de filtro baseada em ia_active
    let matchesStatus = false;
    if (statusFilter === 'ia') {
      // IA Ativa: conversas com IA respondendo
      matchesStatus = conversation.ia_active && conversation.status !== 'closed';
    } else if (statusFilter === 'manual') {
      // Modo Manual: TODAS conversas sem IA (inclui open com ia_active=false)
      matchesStatus = !conversation.ia_active && conversation.status !== 'closed';
    } else if (statusFilter === 'closed') {
      // Encerradas
      matchesStatus = conversation.status === 'closed';
    }

    // Filtro de tags: se nenhuma tag selecionada, mostra todas
    // Se há tags selecionadas, mostra apenas conversas que têm PELO MENOS UMA das tags
    const matchesTags =
      selectedTagIds.size === 0 ||
      (conversation.conversation_tags?.some((ct) =>
        ct.tag && selectedTagIds.has(ct.tag.id)
      ) ?? false);

    // Filtro de não lidas - só se aplica no modo manual quando toggle está ativo
    // Mantém a conversa "recém-lida" visível até clicar em outra
    const matchesUnread =
      statusFilter !== 'manual' || // Não aplica fora do modo manual
      !showOnlyUnread || // Toggle desligado = mostra todas
      conversation.has_unread || // Tem não lidas
      conversation.id === justReadConversationId; // Recém-lida (mantém visível até clicar em outra)

    return matchesSearch && matchesStatus && matchesTags && matchesUnread;
  });

  // Contadores de status (consolidados) — excluem silenciados
  const statusCounts = {
    ia: conversations.filter((c) => c.ia_active && c.status !== 'closed' && !c.contact.is_muted).length,
    manual: conversations.filter((c) => !c.ia_active && c.status !== 'closed' && !c.contact.is_muted).length,
    closed: conversations.filter((c) => c.status === 'closed' && !c.contact.is_muted).length,
  };

  // Contador de não lidas no modo manual
  const unreadInManualCount = conversations.filter(
    (c) => !c.ia_active && c.status !== 'closed' && c.has_unread
  ).length;

  // Limpar seleção ao mudar filtros (sem SSR — só atualiza a URL)
  const clearSelection = () => {
    if (selectedConversationId) {
      window.history.pushState(null, '', '/livechat');
    }
  };

  // Handler para mudança de filtro de status
  const handleStatusFilterChange = (newFilter: 'ia' | 'manual' | 'closed' | 'muted') => {
    if (newFilter !== statusFilter) {
      setStatusFilter(newFilter);
      // Reset toggle de não lidas e justReadConversationId quando sai do modo manual
      if (newFilter !== 'manual') {
        setShowOnlyUnread(false);
        setJustReadConversationId(null);
      }
      clearSelection();
    }
  };

  // Handler para toggle de não lidas
  const handleUnreadToggle = (checked: boolean) => {
    setShowOnlyUnread(checked);
    // Limpa justReadConversationId ao desligar o toggle
    if (!checked) {
      setJustReadConversationId(null);
    }
    clearSelection();
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
    clearSelection();
  };

  // Handler para busca
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // Só limpa seleção se começou a digitar algo novo
    if (value && value !== searchQuery) {
      clearSelection();
    }
  };

  // Converter selectedTagIds para array de Tags para o TagSelector
  const selectedTags = allTags.filter((tag) => selectedTagIds.has(tag.id));

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Badge
            variant={statusFilter === 'ia' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => handleStatusFilterChange('ia')}
          >
            IA ({statusCounts.ia})
          </Badge>
          <Badge
            variant={statusFilter === 'manual' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => handleStatusFilterChange('manual')}
          >
            Modo Manual ({statusCounts.manual})
            {unreadInManualCount > 0 && (
              <MessageCircle className="ml-1 h-3.5 w-3.5 fill-green-500 text-green-500" />
            )}
          </Badge>
          <Badge
            variant={statusFilter === 'closed' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => handleStatusFilterChange('closed')}
          >
            Encerradas ({statusCounts.closed})
          </Badge>
          <Badge
            variant={statusFilter === 'muted' ? 'default' : 'outline'}
            className="cursor-pointer gap-1"
            onClick={() => handleStatusFilterChange('muted')}
          >
            <BellOff className="h-3 w-3" />
            Silenciadas
          </Badge>
        </div>

        {/* Toggle de não lidas - só aparece no modo manual */}
        {statusFilter === 'manual' && (
          <>
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <Label htmlFor="unread-toggle" className="text-sm text-muted-foreground">
                Apenas não lidas ({unreadInManualCount})
              </Label>
              <Switch
                id="unread-toggle"
                checked={showOnlyUnread}
                onCheckedChange={handleUnreadToggle}
              />
            </div>
          </>
        )}

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
            />
          </div>
        )}
      </div>

      {/* Aba Silenciadas: renderiza lista dedicada */}
      {statusFilter === 'muted' && (
        <div className="scrollbar-themed flex-1 overflow-y-auto scroll-smooth">
          <MutedContactsList tenantId={tenantId} />
        </div>
      )}

      <div className={`scrollbar-themed flex-1 overflow-y-auto p-4 space-y-2 scroll-smooth ${statusFilter === 'muted' ? 'hidden' : ''}`}>
        {filteredConversations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground animate-in fade-in-0 duration-300">
            {searchQuery ? (
              'Nenhuma conversa encontrada para esta busca'
            ) : showOnlyUnread && statusFilter === 'manual' ? (
              'Nenhuma conversa com mensagens não lidas'
            ) : selectedTagIds.size > 0 ? (
              'Nenhuma conversa com as tags selecionadas'
            ) : statusFilter === 'ia' ? (
              'Nenhuma conversa com IA ativa'
            ) : statusFilter === 'manual' ? (
              'Nenhuma conversa em modo manual'
            ) : statusFilter === 'closed' ? (
              'Nenhuma conversa encerrada'
            ) : (
              'Nenhuma conversa encontrada'
            )}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation.id}
              onMouseEnter={() => handleHoverEnter(conversation.id)}
              onMouseLeave={handleHoverLeave}
            >
              <ContactItem
                conversation={conversation}
                isSelected={selectedConversationId === conversation.id}
                onMarkUnread={handleMarkUnread}
                onClose={handleCloseConversation}
                onTagToggle={handleCardTagToggle}
                allTags={allTags}
                onClick={() => {
                  // No modo "apenas não lidas", mantém a conversa clicada visível até clicar em outra
                  if (showOnlyUnread && statusFilter === 'manual') {
                    if (conversation.id !== justReadConversationId) {
                      setJustReadConversationId(conversation.id);
                    }
                  }

                  if (onConversationClick) {
                    onConversationClick(conversation.id);
                  } else {
                    window.history.pushState(null, '', `/livechat?conversation=${conversation.id}`);
                  }
                }}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

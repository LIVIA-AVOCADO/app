'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ContactItem } from './contact-item';
import { MessageSearchResultItem } from './message-search-result-item';
import { TagSelector } from '@/components/tags/tag-selector';
import { Search, MessageCircle, BellOff, Star, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useMessageSearch } from '@/hooks/use-message-search';
import { getContactDisplayName } from '@/lib/utils/contact-helpers';
import { MutedContactsList } from './muted-contacts-list';
import type {
  ConversationWithContact,
  ConversationWithContactLocalPatch,
  LivechatTabStatusCounts,
} from '@/types/livechat';
import type { Tag } from '@/types/database-helpers';

/** Formata contadores grandes: ≥1000 vira "1k", "1.3k", "2k" etc. */
function fmtCount(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return (Number.isInteger(k) ? String(k) : k.toFixed(1)) + 'k';
}

type StatusFilter =
  | 'mine' | 'unassigned' | 'team' | 'all'
  | 'ia' | 'manual' | 'closed' | 'muted' | 'important';

interface ContactListProps {
  conversations: ConversationWithContact[];
  selectedConversationId?: string;
  tenantId: string;
  userId?: string;
  userRole?: string;
  userTeamIds?: string[];
  onConversationClick?: (conversationId: string) => void;
  onConversationHover?: (conversationId: string) => void;
  onConversationUpdate?: (conversationId: string, updates: Partial<ConversationWithContact>) => void;
  patchAllConversationsForContact?: (
    contactId: string,
    updates: ConversationWithContactLocalPatch
  ) => void;
  allTags: Tag[];
  tabStatusCounts?: LivechatTabStatusCounts | null;
}

export function ContactList({
  conversations,
  selectedConversationId,
  tenantId,
  userId,
  userRole,
  userTeamIds = [],
  onConversationClick,
  onConversationHover,
  onConversationUpdate,
  patchAllConversationsForContact,
  allTags,
  tabStatusCounts,
}: ContactListProps) {
  const isAdmin = userRole === 'super_admin';
  const [searchQuery, setSearchQuery] = useState('');
  const isMessageSearch = searchQuery.trim().length >= 3;

  // Encerradas são carregadas sob demanda ao clicar na aba (lazy)
  const [closedConversations, setClosedConversations] = useState<ConversationWithContact[]>([]);
  const [closedLoading, setClosedLoading] = useState(false);
  const [closedLoaded, setClosedLoaded] = useState(false);
  const [closedError, setClosedError] = useState(false);

  const {
    results: messageSearchResults,
    isLoading: isMessageSearchLoading,
    isError: isMessageSearchError,
  } = useMessageSearch({ tenantId, query: searchQuery, enabled: isMessageSearch });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ia');

  // Carrega encerradas ao entrar na aba pela primeira vez
  useEffect(() => {
    if (statusFilter !== 'closed' || closedLoaded || closedLoading) return;

    setClosedLoading(true);
    setClosedError(false);

    fetch('/api/livechat/conversations?filter=closed&limit=300')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(({ conversations: closed }: { conversations: ConversationWithContact[] }) => {
        // Exclui ids já presentes na lista ativa (ex.: conversa encerrada nesta sessão)
        const activeIds = new Set(conversations.map((c) => c.id));
        setClosedConversations(closed.filter((c) => !activeIds.has(c.id)));
        setClosedLoaded(true);
      })
      .catch(() => setClosedError(true))
      .finally(() => setClosedLoading(false));
  }, [statusFilter, closedLoaded, closedLoading, conversations]);

  // Ref do container de scroll — necessário para o virtualizer calcular visibilidade
  const listRef = useRef<HTMLDivElement>(null);

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

  const handleToggleImportant = useCallback((conversationId: string, current: boolean) => {
    fetch('/api/conversations/toggle-important', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, tenantId, isImportant: !current }),
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        onConversationUpdate?.(conversationId, { is_important: !current });
        toast.success(!current ? 'Conversa marcada como importante' : 'Importância removida');
      })
      .catch(() => toast.error('Erro ao atualizar conversa'));
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

  const handleCardActivate = useCallback(
    (conversationId: string) => {
      if (showOnlyUnread && statusFilter === 'manual') {
        setJustReadConversationId((curr) => (conversationId !== curr ? conversationId : curr));
      }
      if (onConversationClick) {
        onConversationClick(conversationId);
      } else {
        window.history.pushState(null, '', `/inbox?conversation=${conversationId}`);
      }
    },
    [showOnlyUnread, statusFilter, onConversationClick]
  );

  // Na aba Encerradas: usa a lista lazy + conversas ativas já encerradas nesta sessão
  const allConversationsForFilter =
    statusFilter === 'closed'
      ? [
          ...conversations.filter((c) => c.status === 'closed'),
          ...closedConversations,
        ]
      : conversations;

  // Filtros
  const filteredConversations = allConversationsForFilter.filter((conversation) => {
    const displayName = getContactDisplayName(
      conversation.contact.name,
      conversation.contact.phone
    );
    const matchesSearch = displayName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    // Contatos silenciados nunca aparecem nas abas normais
    if (conversation.contact.is_muted) return false;

    // Lógica de filtro
    let matchesStatus = false;
    const isOpen = conversation.status !== 'closed';
    const isManual = !conversation.ia_active;

    if (statusFilter === 'mine') {
      matchesStatus = isOpen && isManual && conversation.assigned_to === userId;
    } else if (statusFilter === 'unassigned') {
      matchesStatus = isOpen && isManual && !conversation.assigned_to;
    } else if (statusFilter === 'team') {
      matchesStatus = isOpen && isManual &&
        !!conversation.team_id && userTeamIds.includes(conversation.team_id);
    } else if (statusFilter === 'all') {
      matchesStatus = isOpen && isManual;
    } else if (statusFilter === 'ia') {
      matchesStatus = isOpen && conversation.ia_active;
    } else if (statusFilter === 'manual') {
      matchesStatus = isOpen && isManual;
    } else if (statusFilter === 'closed') {
      matchesStatus = conversation.status === 'closed';
    } else if (statusFilter === 'important') {
      matchesStatus = isOpen && !!conversation.is_important;
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

  const derivedStatusCounts = {
    mine: conversations.filter((c) => !c.ia_active && c.status !== 'closed' && !c.contact.is_muted && c.assigned_to === userId).length,
    unassigned: conversations.filter((c) => !c.ia_active && c.status !== 'closed' && !c.contact.is_muted && !c.assigned_to).length,
    team: conversations.filter((c) => !c.ia_active && c.status !== 'closed' && !c.contact.is_muted && !!c.team_id && userTeamIds.includes(c.team_id!)).length,
    all: conversations.filter((c) => !c.ia_active && c.status !== 'closed' && !c.contact.is_muted).length,
    ia: conversations.filter((c) => c.ia_active && c.status !== 'closed' && !c.contact.is_muted).length,
    manual: conversations.filter((c) => !c.ia_active && c.status !== 'closed' && !c.contact.is_muted).length,
    closed: conversations.filter((c) => c.status === 'closed' && !c.contact.is_muted).length,
    important: conversations.filter((c) => c.is_important && c.status !== 'closed' && !c.contact.is_muted).length,
  };

  // Totais das abas: filtros de atribuição sempre derivados localmente (Realtime reativo).
  // ia/manual/closed/important: usa RPC quando disponível, senão derivado.
  const statusCounts = {
    ...derivedStatusCounts,
    ...(tabStatusCounts
      ? { ia: tabStatusCounts.ia, manual: tabStatusCounts.manual, closed: tabStatusCounts.closed, important: tabStatusCounts.important }
      : {}),
  };

  // Não-lidas: SEMPRE derivado do estado reativo (atualiza a cada mensagem via Realtime).
  // tabStatusCounts.unreadManual é SSR-estático e ficaria congelado.
  const unreadInManualCount = conversations.filter(
    (c) => !c.ia_active && c.status !== 'closed' && c.has_unread
  ).length;

  // Virtualizer — renderiza apenas os ~10-15 itens visíveis no scroll em vez de todos.
  // measureElement ajusta automaticamente após o primeiro render real de cada item.
  const virtualizer = useVirtualizer({
    count: filteredConversations.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  // Limpar seleção ao mudar filtros (sem SSR — só atualiza a URL)
  const clearSelection = () => {
    if (selectedConversationId) {
      window.history.pushState(null, '', '/inbox');
    }
  };

  // Handler para mudança de filtro de status
  const handleStatusFilterChange = (newFilter: StatusFilter) => {
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
            placeholder="Buscar contato ou mensagem…"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Filtros de atribuição — Fase 3 */}
          {isAdmin && (
            <Badge
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              className="cursor-pointer gap-1"
              onClick={() => handleStatusFilterChange('all')}
            >
              <Users className="h-3 w-3" />
              Todos ({fmtCount(statusCounts.all)})
            </Badge>
          )}
          <Badge
            variant={statusFilter === 'mine' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => handleStatusFilterChange('mine')}
          >
            Meus ({fmtCount(statusCounts.mine)})
          </Badge>
          <Badge
            variant={statusFilter === 'unassigned' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => handleStatusFilterChange('unassigned')}
          >
            Não atribuídos ({fmtCount(statusCounts.unassigned)})
          </Badge>
          {userTeamIds.length > 0 && (
            <Badge
              variant={statusFilter === 'team' ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => handleStatusFilterChange('team')}
            >
              Meu time ({fmtCount(statusCounts.team)})
            </Badge>
          )}

          {/* Filtros existentes */}
          <Badge
            variant={statusFilter === 'ia' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => handleStatusFilterChange('ia')}
          >
            IA ({fmtCount(statusCounts.ia)})
          </Badge>
          <Badge
            variant={statusFilter === 'manual' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => handleStatusFilterChange('manual')}
          >
            Modo Manual ({fmtCount(statusCounts.manual)})
            {unreadInManualCount > 0 && (
              <MessageCircle className="ml-1 h-3.5 w-3.5 fill-green-500 text-green-500" />
            )}
          </Badge>
          <Badge
            variant={statusFilter === 'closed' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => handleStatusFilterChange('closed')}
          >
            Encerradas ({fmtCount(statusCounts.closed)})
          </Badge>
          <Badge
            variant={statusFilter === 'muted' ? 'default' : 'outline'}
            className="cursor-pointer gap-1"
            onClick={() => handleStatusFilterChange('muted')}
          >
            <BellOff className="h-3 w-3" />
            Silenciadas
          </Badge>
          {statusCounts.important > 0 && (
            <Badge
              variant={statusFilter === 'important' ? 'default' : 'outline'}
              className="cursor-pointer gap-1"
              onClick={() => handleStatusFilterChange('important')}
            >
              <Star className="h-3 w-3" />
              Importantes ({fmtCount(statusCounts.important)})
            </Badge>
          )}
        </div>

        {/* Toggle de não lidas - só aparece no modo manual */}
        {statusFilter === 'manual' && (
          <>
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <Label htmlFor="unread-toggle" className="text-sm text-muted-foreground">
                Apenas não lidas ({fmtCount(unreadInManualCount)})
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
              popoverSide="right"
            />
          </div>
        )}
      </div>

      {/* Aba Silenciadas: renderiza lista dedicada */}
      {statusFilter === 'muted' && (
        <div className="scrollbar-themed flex-1 overflow-y-auto scroll-smooth">
          <MutedContactsList
            tenantId={tenantId}
            onPatchAfterUnmute={
              patchAllConversationsForContact
                ? (contactId) =>
                    patchAllConversationsForContact(contactId, {
                      contact: { is_muted: false, mute_reason: null },
                    })
                : undefined
            }
            onOpenConversation={onConversationClick}
          />
        </div>
      )}

      <div
        ref={listRef}
        className={`scrollbar-themed flex-1 overflow-y-auto p-4 scroll-smooth ${statusFilter === 'muted' ? 'hidden' : ''}`}
      >
        {/* Feedback de carregamento lazy da aba Encerradas */}
        {statusFilter === 'closed' && closedLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Carregando encerradas…</span>
          </div>
        )}
        {statusFilter === 'closed' && closedError && !closedLoading && (
          <div className="text-center py-4 text-sm text-destructive">
            Erro ao carregar conversas encerradas.{' '}
            <button
              className="underline"
              onClick={() => { setClosedLoaded(false); setClosedError(false); }}
            >
              Tentar novamente
            </button>
          </div>
        )}

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
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const conversation = filteredConversations[virtualRow.index];
              if (!conversation) return null;
              return (
                <div
                  key={conversation.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '0.5rem',
                  }}
                >
                  <div
                    onMouseEnter={() => handleHoverEnter(conversation.id)}
                    onMouseLeave={handleHoverLeave}
                  >
                    <ContactItem
                      conversation={conversation}
                      isSelected={selectedConversationId === conversation.id}
                      onActivate={handleCardActivate}
                      onMarkUnread={handleMarkUnread}
                      onClose={handleCloseConversation}
                      onTagToggle={handleCardTagToggle}
                      onToggleImportant={handleToggleImportant}
                      allTags={allTags}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Resultados de busca em mensagens */}
        {isMessageSearch && (
          <>
            <Separator className="my-2" />
            <div className="pb-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Mensagens encontradas
              </span>
            </div>

            {isMessageSearchLoading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Buscando mensagens…</span>
              </div>
            )}

            {isMessageSearchError && !isMessageSearchLoading && (
              <div className="text-center py-4 text-sm text-destructive">
                Erro ao buscar mensagens
              </div>
            )}

            {!isMessageSearchLoading && !isMessageSearchError && messageSearchResults.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Nenhuma mensagem encontrada
              </div>
            )}

            {!isMessageSearchLoading && messageSearchResults.map((result) => (
              <MessageSearchResultItem
                key={result.message_id}
                result={result}
                query={searchQuery.trim()}
                isSelected={selectedConversationId === result.conversation_id}
                onActivate={handleCardActivate}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

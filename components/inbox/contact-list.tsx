'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ContactItem } from './contact-item';
import { MessageSearchResultItem } from './message-search-result-item';
import { TagSelector } from '@/components/tags/tag-selector';
import { Search, BellOff, Star, Loader2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
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

type StatusFilter = 'mine' | 'unassigned' | 'ia' | 'closed';

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

const TAB_LABELS: Record<StatusFilter, string> = {
  mine:       'Meus',
  unassigned: 'Fila',
  ia:         'IA',
  closed:     'Encerradas',
};

export function ContactList({
  conversations,
  selectedConversationId,
  tenantId,
  userId,
  userRole: _userRole,
  userTeamIds: _userTeamIds = [],
  onConversationClick,
  onConversationHover,
  onConversationUpdate,
  patchAllConversationsForContact,
  allTags,
  tabStatusCounts,
}: ContactListProps) {
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

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('mine');
  const [showMuted, setShowMuted] = useState(false);
  const [showOnlyUnread, setShowOnlyUnread] = useState(false);
  const [showOnlyImportant, setShowOnlyImportant] = useState(false);
  // ID da conversa que acabou de ser marcada como lida (mantém visível até clicar em outra)
  const [justReadConversationId, setJustReadConversationId] = useState<string | null>(null);

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

  const handleCardActivate = useCallback(
    (conversationId: string) => {
      const isManualTab = statusFilter === 'mine' || statusFilter === 'unassigned';
      if (showOnlyUnread && isManualTab) {
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

  // Na aba Encerradas: usa a lista lazy + conversas ativas já encerradas nesta sessão.
  // Filtra closedConversations para excluir conversas que foram reabertas (já estão em
  // conversations com status != closed), evitando duplicatas e ghost entries.
  const reopenedIds = new Set(
    conversations.filter((c) => c.status !== 'closed').map((c) => c.id)
  );
  const allConversationsForFilter =
    statusFilter === 'closed'
      ? [
          ...conversations.filter((c) => c.status === 'closed'),
          ...closedConversations.filter((c) => !reopenedIds.has(c.id)),
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

    const isOpen = conversation.status !== 'closed';
    const isManual = !conversation.ia_active;

    let matchesStatus = false;
    if (statusFilter === 'mine') {
      matchesStatus = isOpen && isManual && conversation.assigned_to === userId;
    } else if (statusFilter === 'unassigned') {
      matchesStatus = isOpen && isManual && !conversation.assigned_to;
    } else if (statusFilter === 'ia') {
      matchesStatus = isOpen && conversation.ia_active;
    } else if (statusFilter === 'closed') {
      matchesStatus = conversation.status === 'closed';
    }

    const matchesImportant = !showOnlyImportant || !!conversation.is_important;

    const matchesTags =
      selectedTagIds.size === 0 ||
      (conversation.conversation_tags?.some((ct) =>
        ct.tag && selectedTagIds.has(ct.tag.id)
      ) ?? false);

    // Filtro de não lidas — aplica apenas nas abas Meus e Fila
    const isManualTab = statusFilter === 'mine' || statusFilter === 'unassigned';
    const matchesUnread =
      !isManualTab ||
      !showOnlyUnread ||
      conversation.has_unread ||
      conversation.id === justReadConversationId;

    return matchesSearch && matchesStatus && matchesImportant && matchesTags && matchesUnread;
  });

  // Contadores derivados do estado local (Realtime-reativo)
  const derivedCounts = {
    mine:       conversations.filter((c) => !c.ia_active && c.status !== 'closed' && !c.contact.is_muted && c.assigned_to === userId).length,
    unassigned: conversations.filter((c) => !c.ia_active && c.status !== 'closed' && !c.contact.is_muted && !c.assigned_to).length,
    ia:         conversations.filter((c) => c.ia_active  && c.status !== 'closed' && !c.contact.is_muted).length,
    closed:     conversations.filter((c) => c.status === 'closed' && !c.contact.is_muted).length,
    important:  conversations.filter((c) => c.is_important && c.status !== 'closed' && !c.contact.is_muted).length,
  };

  // ia e closed preferem RPC quando disponível (mais preciso para grandes volumes)
  const tabCounts = {
    ...derivedCounts,
    ...(tabStatusCounts
      ? { ia: tabStatusCounts.ia, closed: tabStatusCounts.closed }
      : {}),
  };

  // Não-lidas por aba: sempre derivado do Realtime (o RPC ficaria congelado)
  const unreadInMine = conversations.filter(
    (c) => !c.ia_active && c.status !== 'closed' && c.has_unread && c.assigned_to === userId && !c.contact.is_muted
  ).length;
  const unreadInFila = conversations.filter(
    (c) => !c.ia_active && c.status !== 'closed' && c.has_unread && !c.assigned_to && !c.contact.is_muted
  ).length;

  const unreadInCurrentTab =
    statusFilter === 'mine' ? unreadInMine :
    statusFilter === 'unassigned' ? unreadInFila : 0;

  // Virtualizer — renderiza apenas os ~10-15 itens visíveis no scroll em vez de todos.
  const virtualizer = useVirtualizer({
    count: filteredConversations.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  const clearSelection = () => {
    if (selectedConversationId) {
      window.history.pushState(null, '', '/inbox');
    }
  };

  const handleStatusFilterChange = (newFilter: StatusFilter) => {
    if (newFilter !== statusFilter) {
      setStatusFilter(newFilter);
      setShowOnlyUnread(false);
      setShowOnlyImportant(false);
      setJustReadConversationId(null);
      clearSelection();
    }
    setShowMuted(false);
  };

  const handleUnreadToggle = (checked: boolean) => {
    setShowOnlyUnread(checked);
    if (!checked) setJustReadConversationId(null);
    clearSelection();
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
    clearSelection();
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value && value !== searchQuery) clearSelection();
  };

  const selectedTags = allTags.filter((tag) => selectedTagIds.has(tag.id));
  const isManualTab = statusFilter === 'mine' || statusFilter === 'unassigned';

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">

        {/* Título + busca + botão silenciadas */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold shrink-0">Inbox</span>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <button
            onClick={() => setShowMuted((v) => !v)}
            title="Silenciadas"
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-md border text-muted-foreground transition-colors',
              showMuted
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <BellOff className="h-4 w-4" />
          </button>
        </div>

        {/* 4 abas primárias */}
        <div className="flex gap-1">
          {(['mine', 'unassigned', 'ia', 'closed'] as StatusFilter[]).map((tab) => {
            const count = tabCounts[tab];
            const hasUnread =
              (tab === 'mine' && unreadInMine > 0) ||
              (tab === 'unassigned' && unreadInFila > 0);
            const isActive = statusFilter === tab && !showMuted;
            return (
              <button
                key={tab}
                onClick={() => handleStatusFilterChange(tab)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {TAB_LABELS[tab]}
                <span className={cn(
                  'text-[10px] tabular-nums',
                  isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                )}>
                  ({fmtCount(count)})
                </span>
                {hasUnread && (
                  <MessageCircle className="h-3 w-3 fill-green-500 text-green-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Filtros secundários — ocultos no painel silenciadas e na aba Encerradas */}
        {!showMuted && statusFilter !== 'closed' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

            {/* Toggle importantes */}
            <button
              onClick={() => setShowOnlyImportant((v) => !v)}
              className={cn(
                'flex items-center gap-1 text-xs rounded-md px-2 py-1 border transition-colors',
                showOnlyImportant
                  ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-400'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              )}
            >
              <Star className={cn('h-3 w-3', showOnlyImportant && 'fill-amber-500 text-amber-500')} />
              Importantes
              {derivedCounts.important > 0 && (
                <span className="tabular-nums">({fmtCount(derivedCounts.important)})</span>
              )}
            </button>

            {/* Toggle não lidas — só nas abas Meus e Fila */}
            {isManualTab && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-2">
                  <Label htmlFor="unread-toggle" className="text-xs text-muted-foreground cursor-pointer select-none">
                    Não lidas
                    {unreadInCurrentTab > 0 && (
                      <span className="ml-1 tabular-nums">({fmtCount(unreadInCurrentTab)})</span>
                    )}
                  </Label>
                  <Switch
                    id="unread-toggle"
                    checked={showOnlyUnread}
                    onCheckedChange={handleUnreadToggle}
                    className="scale-75"
                  />
                </div>
              </>
            )}

            {/* Filtro de tags */}
            {allTags.length > 0 && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <TagSelector
                  mode="filter"
                  selectedTags={selectedTags}
                  availableTags={allTags}
                  onTagToggle={handleTagToggle}
                  placeholder="Tags"
                  popoverSide="right"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Painel silenciadas */}
      {showMuted && (
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

      {/* Lista principal */}
      <div
        ref={listRef}
        className={cn(
          'scrollbar-themed flex-1 overflow-y-auto p-4 scroll-smooth',
          showMuted && 'hidden'
        )}
      >
        {/* Feedback lazy da aba Encerradas */}
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
            ) : showOnlyUnread ? (
              'Nenhuma conversa com mensagens não lidas'
            ) : showOnlyImportant ? (
              'Nenhuma conversa marcada como importante'
            ) : selectedTagIds.size > 0 ? (
              'Nenhuma conversa com as tags selecionadas'
            ) : statusFilter === 'ia' ? (
              'Nenhuma conversa com IA ativa'
            ) : statusFilter === 'mine' ? (
              'Nenhuma conversa atribuída a você'
            ) : statusFilter === 'unassigned' ? (
              'Nenhuma conversa na fila'
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

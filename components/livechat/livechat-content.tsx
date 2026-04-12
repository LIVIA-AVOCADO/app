'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { useDebouncedCallback } from 'use-debounce';
import { ContactList } from './contact-list';
import { ConversationView } from './conversation-view';
import { CustomerDataPanel } from './customer-data-panel';
import { MessagesSkeleton } from './messages-skeleton';
import { useRealtimeConversations } from '@/lib/hooks/use-realtime-conversations';
import { useMessagesCache } from '@/lib/hooks/use-messages-cache';
import { createClient } from '@/lib/supabase/client';
import type {
  ConversationWithContact,
  LivechatTabStatusCounts,
  MessageWithSender,
} from '@/types/livechat';
import type { Tag } from '@/types/database-helpers';

const PREFETCH_COUNT = 5;
const PANEL_PINNED_KEY = 'livechat:panel:pinned';

interface LivechatContentProps {
  conversations: ConversationWithContact[];
  selectedConversationId?: string;
  tenantId: string;
  selectedConversation: ConversationWithContact | null;
  messages: MessageWithSender[] | null;
  allTags: Tag[];
  /** Contagens iniciais das abas (RPC no SSR); atualizadas client-side quando Realtime detecta mudança nos totais. */
  tabStatusCounts: LivechatTabStatusCounts | null;
}

export function LivechatContent({
  conversations: initialConversations,
  selectedConversationId: initialSelectedConvId,
  tenantId,
  selectedConversation: initialSelectedConversation,
  messages: initialMessages,
  allTags,
  tabStatusCounts: initialTabStatusCounts,
}: LivechatContentProps) {
  /** Contagens das abas: inicializadas pelo SSR, re-buscadas via RPC quando Realtime detecta INSERT/status change. */
  const [tabCounts, setTabCounts] = useState<LivechatTabStatusCounts | null>(initialTabStatusCounts);
  const supabaseRef = useRef(createClient());

  const refreshTabCounts = useDebouncedCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseRef.current as any).rpc(
      'livechat_conversation_status_counts',
      { p_tenant_id: tenantId }
    );
    if (error || !data) return;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || typeof row !== 'object') return;
    setTabCounts({
      ia: Number(row.ia_count ?? 0),
      manual: Number(row.manual_count ?? 0),
      closed: Number(row.closed_count ?? 0),
      important: Number(row.important_count ?? 0),
      unreadManual: Number(row.unread_manual_count ?? 0),
    });
  }, 600);

  const { conversations, updateConversation, patchAllConversationsForContact } = useRealtimeConversations(
    tenantId,
    initialConversations,
    refreshTabCounts
  );
  const { fetchAndCache, prefetch } = useMessagesCache();

  // Estado da conversa selecionada (client-side após SSR inicial)
  const [selectedConvId, setSelectedConvId] = useState<string | undefined>(initialSelectedConvId);
  const [currentMessages, setCurrentMessages] = useState<MessageWithSender[] | null>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  /** Carregamento inicial quando há conversa ativa mas currentMessages ainda null (ex.: Realtime). */
  const [isBootstrappingMessages, setIsBootstrappingMessages] = useState(false);

  // Estado do painel de dados do cliente
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelPinned, setIsPanelPinned] = useState(false);

  // Lê preferência de pin do localStorage após hidratação (SSR-safe)
  useEffect(() => {
    setIsPanelPinned(localStorage.getItem(PANEL_PINNED_KEY) === 'true');
  }, []);

  // Conversa ativa: busca da lista Realtime (sempre fresca) com fallback ao SSR inicial
  const activeConversation = selectedConvId
    ? (conversations.find((c) => c.id === selectedConvId) ?? initialSelectedConversation)
    : null;

  // Estado visual do botão 👤 no header
  const isPanelActive = isPanelOpen || isPanelPinned;

  // Prefetch silencioso das primeiras N conversas ao montar
  useEffect(() => {
    const toPreFetch = initialConversations
      .slice(0, PREFETCH_COUNT)
      .filter((c) => c.id !== initialSelectedConvId);
    toPreFetch.forEach((c) => prefetch(c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Há conversa selecionada na lista mas ainda sem mensagens carregadas (ex.: id na URL
  // ou estado local antes do SSR ter a linha; a conversa entra depois via Realtime).
  // Sem isto, ConversationView não monta, useRealtimeMessages nunca subscreve e o painel
  // fica na UI vazia apesar da conversa existir.
  useEffect(() => {
    if (currentMessages !== null) {
      setIsBootstrappingMessages(false);
      return;
    }
    if (!selectedConvId || !activeConversation || activeConversation.id !== selectedConvId) {
      setIsBootstrappingMessages(false);
      return;
    }

    const convIdToFetch = activeConversation.id;
    let cancelled = false;
    setIsBootstrappingMessages(true);

    fetchAndCache(convIdToFetch)
      .then((msgs) => {
        if (!cancelled) setCurrentMessages(msgs);
      })
      .catch((err) => {
        console.error('[livechat] Failed to load messages (auto):', err);
        if (!cancelled) setCurrentMessages([]);
      })
      .finally(() => {
        if (!cancelled) setIsBootstrappingMessages(false);
      });

    return () => {
      cancelled = true;
      setIsBootstrappingMessages(false);
    };
    // Só activeConversation?.id: a identidade do objeto muda a cada UPDATE na lista e
    // recriaria o efeito, cancelando o fetch em curso sem necessidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeConversation alinhado ao id
  }, [selectedConvId, activeConversation?.id, currentMessages, fetchAndCache]);

  // ─── Handlers de conversa ────────────────────────────────────────────────

  const handleConversationUpdate = useCallback(
    (updates: Partial<ConversationWithContact>) => {
      if (selectedConvId) updateConversation(selectedConvId, updates);
      if (updates.status === 'closed') {
        setTimeout(() => {
          setSelectedConvId(undefined);
          setCurrentMessages(null);
          window.history.pushState(null, '', '/livechat');
        }, 600);
      }
    },
    [selectedConvId, updateConversation]
  );

  // Ao silenciar: todas as conversas desse contato refletem mute + IA pausada
  const handleContactMuted = useCallback(
    (detail: { muteReason: string }) => {
      if (!selectedConvId || !activeConversation) return;
      patchAllConversationsForContact(activeConversation.contact.id, {
        ia_active: false,
        contact: {
          ...activeConversation.contact,
          is_muted: true,
          mute_reason: detail.muteReason,
        },
      });
      setTimeout(() => {
        setSelectedConvId(undefined);
        setCurrentMessages(null);
        window.history.pushState(null, '', '/livechat');
      }, 800);
    },
    [selectedConvId, activeConversation, patchAllConversationsForContact]
  );

  const handleContactUnmuted = useCallback(() => {
    if (!activeConversation) return;
    patchAllConversationsForContact(activeConversation.contact.id, {
      contact: {
        ...activeConversation.contact,
        is_muted: false,
        mute_reason: null,
      },
    });
  }, [activeConversation, patchAllConversationsForContact]);

  const handleConversationClick = useCallback(
    async (conversationId: string) => {
      if (conversationId === selectedConvId) return;

      setSelectedConvId(conversationId);
      setIsLoadingMessages(true);
      window.history.pushState(null, '', `/livechat?conversation=${conversationId}`);

      // Otimistic: zera has_unread localmente sem esperar o Realtime (evita badge preso)
      updateConversation(conversationId, { has_unread: false, unread_count: 0 });

      fetch('/api/conversations/mark-as-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, tenantId }),
      }).catch(console.error);

      try {
        const msgs = await fetchAndCache(conversationId);
        setCurrentMessages(msgs);
      } catch (err) {
        console.error('[livechat] Failed to load messages:', err);
        setCurrentMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [selectedConvId, tenantId, fetchAndCache, updateConversation]
  );

  // ─── Handlers do painel de dados ─────────────────────────────────────────

  const handleTogglePanel = useCallback(() => {
    if (isPanelPinned) {
      // Desafixar: remove a coluna lateral
      setIsPanelPinned(false);
      localStorage.setItem(PANEL_PINNED_KEY, 'false');
    } else {
      setIsPanelOpen((prev) => !prev);
    }
  }, [isPanelPinned]);

  const handlePinToggle = useCallback(() => {
    const next = !isPanelPinned;
    setIsPanelPinned(next);
    localStorage.setItem(PANEL_PINNED_KEY, String(next));
    if (next) {
      // Fixar: fecha o Sheet, painel vira coluna
      setIsPanelOpen(false);
    }
  }, [isPanelPinned]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Coluna esquerda: lista de conversas — superfície elevada sobre o canvas */}
      <aside className="w-72 lg:w-80 xl:w-96 border-r border-border flex flex-col h-full bg-card">
        <div className="p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-semibold">Conversas</h2>
          <p className="text-sm text-on-surface-variant">
            Atendimentos ativos • WhatsApp
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <ContactList
            conversations={conversations}
            selectedConversationId={selectedConvId}
            tenantId={tenantId}
            onConversationClick={handleConversationClick}
            onConversationHover={prefetch}
            onConversationUpdate={updateConversation}
            patchAllConversationsForContact={patchAllConversationsForContact}
            allTags={allTags}
            tabStatusCounts={tabCounts}
          />
        </div>
      </aside>

      {/* Área principal: conversa */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-card">
        {isLoadingMessages || isBootstrappingMessages ? (
          <div className="flex flex-col h-full">
            <div className="p-4 border-b">
              <div className="h-6 w-48 bg-foreground/[0.08] animate-pulse rounded" />
            </div>
            <MessagesSkeleton />
          </div>
        ) : activeConversation && currentMessages ? (
          <ConversationView
            initialConversation={activeConversation}
            initialMessages={currentMessages}
            tenantId={tenantId}
            contactId={activeConversation.contact.id}
            contactName={activeConversation.contact.name ?? ''}
            contactPhone={activeConversation.contact.phone}
            contactIsMuted={activeConversation.contact.is_muted}
            channel={activeConversation.channel}
            allTags={allTags}
            conversationTags={activeConversation.conversation_tags}
            onConversationUpdate={handleConversationUpdate}
            onContactMuted={handleContactMuted}
            onContactUnmuted={handleContactUnmuted}
            onTogglePanel={handleTogglePanel}
            isPanelActive={isPanelActive}
          />
        ) : (
          <div className="flex h-full items-center justify-center animate-in fade-in-0 duration-300">
            <div className="text-center space-y-4 max-w-sm px-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl icon-gradient-brand flex items-center justify-center shadow-md">
                  <MessageSquare className="h-8 w-8 text-white" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold">Selecione uma conversa</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Escolha um atendimento no painel ao lado para visualizar as mensagens e interagir com o cliente.
                </p>
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
                <ArrowLeft className="h-3 w-3" />
                <span>Use os filtros para encontrar conversas mais rapidamente</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Coluna direita: painel fixado (modo pinned) */}
      {activeConversation && isPanelPinned && (
        <aside className="w-64 lg:w-72 xl:w-80 border-l flex flex-col h-full overflow-hidden shrink-0 bg-card">
          <CustomerDataPanel
            contactId={activeConversation.contact.id}
            tenantId={tenantId}
            isPinned
            onPinToggle={handlePinToggle}
          />
        </aside>
      )}

      {/* Sheet: painel sob demanda (modo não fixado) */}
      {activeConversation && (
        <Sheet open={isPanelOpen && !isPanelPinned} onOpenChange={setIsPanelOpen}>
          <SheetContent side="right" className="w-72 xl:w-80 p-0 flex flex-col">
            <SheetTitle className="sr-only">Dados do cliente</SheetTitle>
            <CustomerDataPanel
              contactId={activeConversation.contact.id}
              tenantId={tenantId}
              isPinned={false}
              onPinToggle={handlePinToggle}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

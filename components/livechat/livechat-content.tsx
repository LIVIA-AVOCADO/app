'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { ContactList } from './contact-list';
import { ConversationView } from './conversation-view';
import { CustomerDataPanel } from './customer-data-panel';
import { MessagesSkeleton } from './messages-skeleton';
import { useRealtimeConversations } from '@/lib/hooks/use-realtime-conversations';
import { useMessagesCache } from '@/lib/hooks/use-messages-cache';
import type { ConversationWithContact, MessageWithSender } from '@/types/livechat';
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
}

export function LivechatContent({
  conversations: initialConversations,
  selectedConversationId: initialSelectedConvId,
  tenantId,
  selectedConversation: initialSelectedConversation,
  messages: initialMessages,
  allTags,
}: LivechatContentProps) {
  const { conversations, updateConversation } = useRealtimeConversations(tenantId, initialConversations);
  const { fetchAndCache, prefetch } = useMessagesCache();

  // Estado da conversa selecionada (client-side após SSR inicial)
  const [selectedConvId, setSelectedConvId] = useState<string | undefined>(initialSelectedConvId);
  const [currentMessages, setCurrentMessages] = useState<MessageWithSender[] | null>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

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

  const handleConversationClick = useCallback(
    async (conversationId: string) => {
      if (conversationId === selectedConvId) return;

      setSelectedConvId(conversationId);
      setIsLoadingMessages(true);
      window.history.pushState(null, '', `/livechat?conversation=${conversationId}`);

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
    [selectedConvId, tenantId, fetchAndCache]
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
    <div className="flex h-full overflow-hidden">
      {/* Coluna esquerda: lista de conversas */}
      <aside className="w-96 border-r flex flex-col h-full">
        <div className="p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Conversas</h2>
          <p className="text-sm text-muted-foreground">
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
            allTags={allTags}
          />
        </div>
      </aside>

      {/* Área principal: conversa */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {isLoadingMessages ? (
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
            contactName={activeConversation.contact.name ?? ''}
            contactPhone={activeConversation.contact.phone}
            allTags={allTags}
            conversationTags={activeConversation.conversation_tags}
            onConversationUpdate={handleConversationUpdate}
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
        <aside className="w-80 border-l flex flex-col h-full overflow-hidden shrink-0">
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
          <SheetContent side="right" className="w-80 p-0 flex flex-col">
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

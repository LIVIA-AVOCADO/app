'use client';

/**
 * LivechatContent — Shell client-side do livechat
 *
 * Mudança principal (Fase 5 - 2026-03-18):
 * Seleção de conversa é agora totalmente client-side.
 * Antes: router.push() → SSR → re-fetch de todas conversas + mensagens (1-2s por clique)
 * Depois: setState + fetchAndCache() → só busca as mensagens (200-400ms, ou 0ms se cacheado)
 *
 * URL é atualizada via window.history.pushState (sem SSR).
 * SSR permanece apenas no carregamento inicial da página.
 */

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { ContactList } from './contact-list';
import { ConversationView } from './conversation-view';
import { CustomerDataPanel } from './customer-data-panel';
import { MessagesSkeleton } from './messages-skeleton';
import { useRealtimeConversations } from '@/lib/hooks/use-realtime-conversations';
import { useMessagesCache } from '@/lib/hooks/use-messages-cache';
import type { ConversationWithContact, MessageWithSender } from '@/types/livechat';
import type { Tag } from '@/types/database-helpers';

// Número de conversas visíveis a pré-carregar em background no mount
const PREFETCH_COUNT = 5;

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

  // Estado client-side da conversa selecionada (inicializado do SSR)
  const [selectedConvId, setSelectedConvId] = useState<string | undefined>(initialSelectedConvId);
  const [currentMessages, setCurrentMessages] = useState<MessageWithSender[] | null>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Conversa ativa: busca da lista Realtime (sempre fresca) com fallback ao dado SSR inicial
  const activeConversation = selectedConvId
    ? (conversations.find((c) => c.id === selectedConvId) ?? initialSelectedConversation)
    : null;

  // Prefetch silencioso das primeiras N conversas visíveis ao montar
  // Não adiciona canais Realtime — apenas HTTP requests em background
  useEffect(() => {
    const toPreFetch = initialConversations
      .slice(0, PREFETCH_COUNT)
      .filter((c) => c.id !== initialSelectedConvId);
    toPreFetch.forEach((c) => prefetch(c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount — lista inicial do SSR é estável

  const handleConversationUpdate = useCallback(
    (updates: Partial<ConversationWithContact>) => {
      if (selectedConvId) {
        updateConversation(selectedConvId, updates);
      }
      if (updates.status === 'closed') {
        // Breve delay para feedback visual antes de voltar ao empty state
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

      // 1. Feedback visual imediato
      setSelectedConvId(conversationId);
      setIsLoadingMessages(true);

      // 2. Atualiza URL sem disparar SSR
      window.history.pushState(null, '', `/livechat?conversation=${conversationId}`);

      // 3. Marcar como lida (fire and forget)
      fetch('/api/conversations/mark-as-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, tenantId }),
      }).catch(console.error);

      // 4. Busca mensagens: cache hit → instantâneo, cache miss → ~200-400ms
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

  return (
    <div className="flex h-full overflow-hidden">
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
            allTags={allTags}
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {isLoadingMessages ? (
          // Skeleton aparece INSTANTANEAMENTE enquanto busca mensagens
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

      {activeConversation && (
        <aside className="w-80 border-l flex flex-col h-full overflow-hidden">
          <CustomerDataPanel
            contactId={activeConversation.contact.id}
            tenantId={tenantId}
          />
        </aside>
      )}
    </div>
  );
}

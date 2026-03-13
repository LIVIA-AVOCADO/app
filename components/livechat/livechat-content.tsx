'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { ContactList } from './contact-list';
import { ConversationView } from './conversation-view';
import { CustomerDataPanel } from './customer-data-panel';
import { MessagesSkeleton } from './messages-skeleton';
import { useRealtimeConversations } from '@/lib/hooks/use-realtime-conversations';
import type { ConversationWithContact, MessageWithSender } from '@/types/livechat';
import type { Conversation, Tag } from '@/types/database-helpers';

interface LivechatContentProps {
  conversations: ConversationWithContact[];
  selectedConversationId?: string;
  tenantId: string;
  selectedConversation: ConversationWithContact | null;
  conversation: Conversation | null;
  messages: MessageWithSender[] | null;
  allTags: Tag[]; // Todas as tags do tenant
}

export function LivechatContent({
  conversations: initialConversations,
  selectedConversationId,
  tenantId,
  selectedConversation,
  conversation,
  messages,
  allTags,
}: LivechatContentProps) {
  const router = useRouter();
  const { conversations, updateConversation } = useRealtimeConversations(tenantId, initialConversations);
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);

  // Callback para atualização otimista a partir do ConversationView
  const handleConversationUpdate = useCallback((updates: Partial<ConversationWithContact>) => {
    if (selectedConversationId) {
      updateConversation(selectedConversationId, updates);
    }
    // Ao encerrar conversa, volta para o empty state após breve delay
    // para que o usuário veja o feedback visual antes de navegar
    if (updates.status === 'closed') {
      setTimeout(() => router.push('/livechat'), 600);
    }
  }, [selectedConversationId, updateConversation, router]);

  // Handler que dispara ANTES da navegação
  const handleConversationClick = (conversationId: string) => {
    // Feedback instantâneo
    setLoadingConversationId(conversationId);

    // Marcar como lida (fire and forget - não bloqueia navegação)
    fetch('/api/conversations/mark-as-read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, tenantId }),
    }).catch(console.error);

    // Navegação (que vai demorar 1-2s)
    router.push(`/livechat?conversation=${conversationId}`);
  };

  // Resetar loading quando a conversa correta for carregada
  useEffect(() => {
    if (loadingConversationId && conversation?.id === loadingConversationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoadingConversationId(null);
    }
  }, [conversation?.id, loadingConversationId]);

  // Detecta se está em transição de loading
  const isLoading = loadingConversationId && conversation?.id !== loadingConversationId;

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
            selectedConversationId={selectedConversationId}
            tenantId={tenantId}
            onConversationClick={handleConversationClick}
            allTags={allTags}
          />
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {isLoading ? (
          // Skeleton aparece INSTANTANEAMENTE
          <div className="flex flex-col h-full">
            <div className="p-4 border-b">
              <div className="h-6 w-48 bg-foreground/[0.08] animate-pulse rounded" />
            </div>
            <MessagesSkeleton />
          </div>
        ) : conversation && messages && selectedConversation ? (
          <ConversationView
            initialConversation={conversation}
            initialMessages={messages}
            tenantId={tenantId}
            contactName={selectedConversation.contact.name}
            contactPhone={selectedConversation.contact.phone}
            allTags={allTags}
            conversationTags={selectedConversation.conversation_tags}
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

      {selectedConversation && (
        <aside className="w-80 border-l flex flex-col h-full overflow-hidden">
          <CustomerDataPanel
            contactId={selectedConversation.contact.id}
            tenantId={tenantId}
          />
        </aside>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { MessageItem } from './message-item';
import { MessageInput } from './message-input';
import { ConversationHeader } from './conversation-header';
import { ScrollToBottomButton } from './scroll-to-bottom-button';
import { MessagesSkeleton } from './messages-skeleton';
import { TypingIndicator } from './typing-indicator';
import { useRealtimeMessages } from '@/lib/hooks/use-realtime-messages';
import { useRealtimeConversation } from '@/lib/hooks/use-realtime-conversation';
import { useChatScroll } from '@/lib/hooks/use-chat-scroll';
import { useTypingPresence } from '@/lib/hooks/use-typing-presence';
import { useSendMessage } from '@/lib/hooks/use-send-message';
import { getMessageDayLabel } from '@/lib/utils/date-helpers';
import type { Conversation, Tag } from '@/types/database-helpers';
import type { ConversationWithContact, MessageWithSender } from '@/types/livechat';

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span className="px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground select-none">
        {label}
      </span>
    </div>
  );
}

interface ConversationViewProps {
  initialConversation: Conversation;
  initialMessages: MessageWithSender[];
  tenantId: string;
  contactId: string;
  contactName: string;
  contactPhone?: string | null;
  contactIsMuted?: boolean;
  allTags: Tag[]; // Todas as tags do tenant
  conversationTags?: Array<{ tag: Tag }>; // Tags atuais da conversa
  onConversationUpdate?: (updates: Partial<ConversationWithContact>) => void;
  onContactMuted?: () => void;
  onContactUnmuted?: () => void;
  onTogglePanel?: () => void;
  isPanelActive?: boolean;
}

export function ConversationView({
  initialConversation,
  initialMessages,
  tenantId,
  contactId,
  contactName,
  contactPhone,
  contactIsMuted,
  allTags,
  conversationTags,
  onConversationUpdate,
  onContactMuted,
  onContactUnmuted,
  onTogglePanel,
  isPanelActive,
}: ConversationViewProps) {
  const { messages, addMessage, replaceTempMessage, updateMessageStatus, removeMessage } =
    useRealtimeMessages(initialConversation.id, initialMessages);
  const { conversation } = useRealtimeConversation(initialConversation);
  const { isRemoteTyping, broadcastTyping } = useTypingPresence(initialConversation.id);

  // Estado de reply
  const [replyToMessage, setReplyToMessage] = useState<MessageWithSender | null>(null);

  // Mapa de mensagens por ID para resolução rápida do quotedMessage
  const messagesById = useMemo(
    () => new Map(messages.map((m) => [m.id, m])),
    [messages]
  );

  // Retry: remove a mensagem falha e reenvia
  const { sendMessage: retrySend } = useSendMessage({
    conversation,
    tenantId,
    onOptimisticAdd: addMessage,
    onTempConfirmed: replaceTempMessage,
    onTempFailed: (tempId) => updateMessageStatus(tempId, 'failed'),
  });

  const handleRetry = useCallback(
    (failedId: string, content: string) => {
      removeMessage(failedId);
      retrySend(content);
    },
    [removeMessage, retrySend]
  );

  const { scrollRef, isAtBottom, unreadCount, scrollToBottom } =
    useChatScroll(messages);

  // IDs das mensagens iniciais — memoizado por conversa (muda só quando troca de conversa)
  // Mensagens além deste set são "novas" e recebem animação de entrada
  const initialMessageIds = useMemo(
    () => new Set(initialMessages.map((m) => m.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialConversation.id] // Recalcula apenas quando a conversa muda, não a cada nova mensagem
  );

  // Loading transition state
  const [isLoadingTransition, setIsLoadingTransition] = useState(false);
  const [currentConvId, setCurrentConvId] = useState(initialConversation.id);
  const loadingStartTimeRef = useRef<number>(0);

  // Detecta mudança de conversa
  useEffect(() => {
    if (initialConversation.id !== currentConvId) {
      setIsLoadingTransition(true);
      setCurrentConvId(initialConversation.id);
      loadingStartTimeRef.current = Date.now();
    }
  }, [initialConversation.id, currentConvId]);

  // Remove loading quando messages carregam (com delay mínimo)
  useEffect(() => {
    if (isLoadingTransition && messages.length > 0) {
      const MIN_LOADING_TIME = 150; // ms
      const elapsed = Date.now() - loadingStartTimeRef.current;
      const remaining = Math.max(0, MIN_LOADING_TIME - elapsed);

      setTimeout(() => {
        setIsLoadingTransition(false);
      }, remaining);
    }
  }, [isLoadingTransition, messages.length]);

  return (
    <div className="flex flex-col h-full bg-card">
      <ConversationHeader
        contactId={contactId}
        contactName={contactName}
        contactPhone={contactPhone}
        contactIsMuted={contactIsMuted}
        conversation={conversation}
        tenantId={tenantId}
        allTags={allTags}
        conversationTags={conversationTags}
        onConversationUpdate={onConversationUpdate}
        onContactMuted={onContactMuted}
        onContactUnmuted={onContactUnmuted}
        onTogglePanel={onTogglePanel}
        isPanelActive={isPanelActive}
      />

      <div className="flex-1 relative overflow-hidden">
        {isLoadingTransition ? (
          <MessagesSkeleton />
        ) : (
          <>
            <div
              ref={scrollRef}
              className="scrollbar-themed h-full overflow-y-auto p-4 scroll-smooth bg-card"
            >
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma mensagem ainda
                </div>
              ) : (
                (() => {
                  const firstOfDay = new Set<string>();
                  let lastKey = '';
                  for (const msg of messages) {
                    const key = new Date(msg.timestamp).toDateString();
                    if (key !== lastKey) {
                      firstOfDay.add(msg.id);
                      lastKey = key;
                    }
                  }

                  return messages.map((message) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const quotedId = (message as any).quoted_message_id as string | null | undefined;
                    const quotedMsg = quotedId ? messagesById.get(quotedId) : null;
                    const messageWithQuote: MessageWithSender = quotedMsg
                      ? { ...message, quotedMessage: { id: quotedMsg.id, content: quotedMsg.content, sender_type: quotedMsg.sender_type, senderUser: quotedMsg.senderUser } }
                      : message;

                    return (
                      <div key={message.id}>
                        {firstOfDay.has(message.id) && (
                          <DateSeparator label={getMessageDayLabel(message.timestamp)} />
                        )}
                        <MessageItem
                          message={messageWithQuote}
                          conversationId={conversation.id}
                          tenantId={tenantId}
                          isNew={!initialMessageIds.has(message.id)}
                          onRetry={handleRetry}
                          onReply={conversation.status !== 'closed' ? setReplyToMessage : undefined}
                        />
                      </div>
                    );
                  });
                })()
              )}
              <TypingIndicator isVisible={isRemoteTyping} />
            </div>

            <ScrollToBottomButton
              show={!isAtBottom}
              unreadCount={unreadCount}
              onClick={() => scrollToBottom()}
            />
          </>
        )}
      </div>

      <Separator />

      <MessageInput
        conversation={conversation}
        tenantId={tenantId}
        contactName={contactName}
        disabled={conversation.status === 'closed'}
        onOptimisticAdd={addMessage}
        onTempConfirmed={replaceTempMessage}
        onTempFailed={(tempId) => updateMessageStatus(tempId, 'failed')}
        onTyping={broadcastTyping}
        replyToMessage={replyToMessage}
        onClearReply={() => setReplyToMessage(null)}
      />
    </div>
  );
}

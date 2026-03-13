'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { QuickRepliesPanel } from './quick-replies-panel';
import { QuickReplyCommand } from './quick-reply-command';
import { useQuickReplyCommand } from '@/hooks/use-quick-reply-command';
import { usePrefetchQuickReplies } from '@/hooks/use-quick-replies-cache';
import type { Conversation } from '@/types/database-helpers';
import type { MessageWithSender } from '@/types/livechat';
import { PauseIAConfirmDialog } from './pause-ia-confirm-dialog';
import { useApiCall } from '@/lib/hooks';

interface MessageInputProps {
  conversation: Conversation;
  tenantId: string;
  contactName: string;
  onSend?: () => void;
  onMessageSent?: (message: MessageWithSender) => void;
  disabled?: boolean;
}

export function MessageInput({
  conversation,
  tenantId,
  contactName,
  onSend,
  onMessageSent,
  disabled = false,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showPauseIADialog, setShowPauseIADialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Prefetch: carrega respostas rápidas em background para abertura instantânea
  usePrefetchQuickReplies({ tenantId });

  // API calls hooks
  const resumeConversation = useApiCall('/api/conversations/resume', 'POST', {
    suppressSuccessToast: true,
    suppressErrorToast: true, // Handled manually below
  });

  const sendMessageApi = useApiCall('/api/n8n/send-message', 'POST', {
    suppressSuccessToast: true,
    suppressErrorToast: true, // Handled manually below
    onSuccess: () => {
      setContent('');
      onSend?.();
    },
  });

  const isSending = resumeConversation.isLoading || sendMessageApi.isLoading;

  // Hook para gerenciar command palette de respostas rápidas
  const quickReplyCommand = useQuickReplyCommand({
    onRemoveText: (start, length) => {
      // Remove "/" ou "//" do texto
      const newContent = content.slice(0, start) + content.slice(start + length);
      setContent(newContent);

      // Atualiza cursor após remoção
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start;
          textareaRef.current.selectionEnd = start;
          textareaRef.current.focus();
        }
      }, 0);
    },
  });

  const handleSendClick = () => {
    if (!content.trim() || isSending) return;

    // Se IA está ativa, mostrar confirmação antes de enviar
    if (conversation.ia_active) {
      setPendingMessage(content.trim());
      setShowPauseIADialog(true);
      return;
    }

    // Se IA já está pausada, enviar direto
    sendMessage(content.trim());
  };

  const handleConfirmSendAndPauseIA = () => {
    sendMessage(pendingMessage);
    setPendingMessage('');
  };

  const sendMessage = async (messageContent: string) => {
    if (!messageContent || isSending) return;

    try {
      // Enviar mensagem normalmente
      const result = await sendMessageApi.execute({
        conversationId: conversation.id,
        tenantId: tenantId,
        content: messageContent,
      });

      if (!result) {
        toast.error('Erro ao enviar mensagem');
        return;
      }

      // Inserção otimista: exibe a mensagem imediatamente sem esperar realtime
      const resp = result as { message?: { id: string; status?: string } };
      if (resp.message?.id && onMessageSent) {
        const now = new Date().toISOString();
        const optimisticMessage: MessageWithSender = {
          id: resp.message.id,
          conversation_id: conversation.id,
          content: messageContent,
          sender_type: 'attendant',
          sender_user_id: null,
          sender_agent_id: null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: (resp.message.status ?? 'pending') as any,
          timestamp: now,
          created_at: now,
          updated_at: now,
          external_message_id: null,
          feedback_text: null,
          feedback_type: null,
          senderUser: null,
        };
        onMessageSent(optimisticMessage);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error(
        error instanceof Error ? error.message : 'Erro ao enviar mensagem'
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleQuickReplySelect = (message: string) => {
    setContent(message);
  };

  const handleQuickReplyCommandSelect = (processedContent: string, _quickReplyId: string) => {
    // Insere o conteúdo da resposta rápida na posição do trigger
    const { triggerPosition } = quickReplyCommand;
    const newContent =
      content.slice(0, triggerPosition) +
      processedContent +
      content.slice(triggerPosition);

    setContent(newContent);

    // Move cursor para o final do texto inserido
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = triggerPosition + processedContent.length;
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;

    setContent(newValue);

    // Notifica o hook sobre mudanças no input (para detectar "/" e "//")
    quickReplyCommand.handleTextareaInput(newValue, cursorPos);
  };

  return (
    <div className="flex gap-2 p-4 border-t">
      <QuickRepliesPanel
        conversationId={conversation.id}
        tenantId={tenantId}
        contactName={contactName}
        onSelect={handleQuickReplySelect}
        disabled={disabled || isSending}
      />
      <Textarea
        ref={textareaRef}
        placeholder="Digite sua mensagem..."
        value={content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        disabled={disabled || isSending}
        className="min-h-[60px] max-h-[120px] resize-none transition-opacity duration-200"
        style={{ opacity: isSending ? 0.6 : 1 }}
      />
      <Button
        onClick={handleSendClick}
        disabled={!content.trim() || disabled || isSending}
        size="icon"
        className="h-[60px] w-[60px] transition-all duration-200"
      >
        {isSending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Send className="h-5 w-5 transition-transform duration-150 group-hover:translate-x-0.5" />
        )}
      </Button>

      <PauseIAConfirmDialog
        open={showPauseIADialog}
        onOpenChange={setShowPauseIADialog}
        onConfirm={handleConfirmSendAndPauseIA}
        trigger="message_send"
      />

      <QuickReplyCommand
        isOpen={quickReplyCommand.isOpen}
        onClose={quickReplyCommand.closeCommand}
        mode={quickReplyCommand.mode}
        tenantId={tenantId}
        contactName={contactName}
        conversationId={conversation.id}
        onSelect={handleQuickReplyCommandSelect}
      />
    </div>
  );
}

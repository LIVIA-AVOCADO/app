'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, X } from 'lucide-react';
import { QuickRepliesPanel } from './quick-replies-panel';
import { QuickReplyCommand } from './quick-reply-command';
import { useQuickReplyCommand } from '@/hooks/use-quick-reply-command';
import { usePrefetchQuickReplies } from '@/hooks/use-quick-replies-cache';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/types/database-helpers';
import type { MessageWithSender } from '@/types/livechat';
import { PauseIAConfirmDialog } from './pause-ia-confirm-dialog';
import { useSendMessage } from '@/lib/hooks/use-send-message';

interface MessageInputProps {
  conversation: Conversation;
  tenantId: string;
  contactName: string;
  onSend?: () => void;
  onOptimisticAdd: (message: MessageWithSender) => void;
  onTempConfirmed: (tempId: string, confirmed: MessageWithSender) => void;
  onTempFailed: (tempId: string) => void;
  onTyping?: () => void;
  disabled?: boolean;
  replyToMessage?: MessageWithSender | null;
  onClearReply?: () => void;
}

export function MessageInput({
  conversation,
  tenantId,
  contactName,
  onSend,
  onOptimisticAdd,
  onTempConfirmed,
  onTempFailed,
  onTyping,
  disabled = false,
  replyToMessage,
  onClearReply,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [showPauseIADialog, setShowPauseIADialog] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Prefetch: carrega respostas rápidas em background para abertura instantânea
  usePrefetchQuickReplies({ tenantId });

  const { sendMessage } = useSendMessage({
    conversation,
    tenantId,
    onOptimisticAdd,
    onTempConfirmed,
    onTempFailed,
    onAfterSend: () => {
      setContent('');
      onSend?.();
    },
  });

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
    if (!content.trim()) return;

    // Se IA está ativa, mostrar confirmação antes de enviar
    if (conversation.ia_active) {
      setPendingMessage(content.trim());
      setShowPauseIADialog(true);
      return;
    }

    sendMessage(content.trim(), replyToMessage);
    onClearReply?.();
  };

  const handleConfirmSendAndPauseIA = () => {
    sendMessage(pendingMessage, replyToMessage);
    setPendingMessage('');
    onClearReply?.();
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

    // Sinaliza digitação para typing indicator
    if (newValue.trim()) onTyping?.();
  };

  const replyLabel =
    replyToMessage?.sender_type === 'customer'
      ? 'Cliente'
      : replyToMessage?.sender_type === 'ai'
        ? 'IA'
        : replyToMessage?.senderUser?.full_name || 'Atendente';

  return (
    <div className="flex flex-col border-t">
      {/* Preview da mensagem sendo respondida */}
      {replyToMessage && (
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <div className="flex-1 border-l-2 border-blue-400 pl-2.5 bg-muted/50 rounded-r-md py-1 pr-2 min-w-0">
            <p className="text-[11px] font-semibold text-blue-600 mb-0.5">{replyLabel}</p>
            <p className="text-xs text-muted-foreground truncate">{replyToMessage.content}</p>
          </div>
          <button
            onClick={onClearReply}
            className="flex-shrink-0 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Cancelar resposta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className={cn('flex gap-2 p-4', replyToMessage && 'pt-2')}>
      <QuickRepliesPanel
        conversationId={conversation.id}
        tenantId={tenantId}
        contactName={contactName}
        onSelect={handleQuickReplySelect}
        disabled={disabled}
      />
      <Textarea
        ref={textareaRef}
        placeholder="Digite sua mensagem..."
        value={content}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="min-h-[60px] max-h-[120px] resize-none"
      />
      <Button
        onClick={handleSendClick}
        disabled={!content.trim() || disabled}
        size="icon"
        className="h-[60px] w-[60px]"
      >
        <Send className="h-5 w-5" />
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
    </div>
  );
}

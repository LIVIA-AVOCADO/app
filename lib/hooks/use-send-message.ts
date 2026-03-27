'use client';

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { Conversation } from '@/types/database-helpers';
import type { MessageWithSender } from '@/types/livechat';

interface UseSendMessageOptions {
  conversation: Conversation;
  tenantId: string;
  onOptimisticAdd: (message: MessageWithSender) => void;
  onTempConfirmed: (tempId: string, confirmed: MessageWithSender) => void;
  onTempFailed: (tempId: string) => void;
  onAfterSend?: () => void;
}

export function useSendMessage({
  conversation,
  tenantId,
  onOptimisticAdd,
  onTempConfirmed,
  onTempFailed,
  onAfterSend,
}: UseSendMessageOptions) {
  const inFlightRef = useRef(new Set<string>());

  const sendMessage = useCallback(
    async (messageContent: string, replyTo?: MessageWithSender | null) => {
      const trimmed = messageContent.trim();
      if (!trimmed) return;

      // Gera ID temporário único para reconciliação
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const now = new Date().toISOString();

      // 1. Adiciona mensagem otimista IMEDIATAMENTE (antes da API call)
      const optimisticMessage: MessageWithSender = {
        id: tempId,
        conversation_id: conversation.id,
        content: trimmed,
        sender_type: 'attendant',
        sender_user_id: null,
        sender_agent_id: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: 'pending' as any,
        timestamp: now,
        created_at: now,
        updated_at: now,
        external_message_id: null,
        feedback_text: null,
        feedback_type: null,
        senderUser: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(replyTo ? { quoted_message_id: replyTo.id } as any : {}),
        quotedMessage: replyTo
          ? { id: replyTo.id, content: replyTo.content, sender_type: replyTo.sender_type, senderUser: replyTo.senderUser }
          : null,
      };

      onOptimisticAdd(optimisticMessage);
      onAfterSend?.(); // Limpa textarea / notifica parent imediatamente
      inFlightRef.current.add(tempId);

      // 2. Chama API em background
      try {
        const response = await fetch('/api/n8n/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: conversation.id,
            tenantId,
            content: trimmed,
            ...(replyTo ? { quotedMessageId: replyTo.id } : {}),
          }),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err?.error || 'Erro ao enviar mensagem');
        }

        const result = await response.json();
        const realId: string | undefined = result?.message?.id;
        const realStatus: string = result?.message?.status ?? 'pending';

        if (realId) {
          // Substitui temp pelo confirmado com ID real
          const confirmedMessage: MessageWithSender = {
            ...optimisticMessage,
            id: realId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: realStatus as any,
          };
          onTempConfirmed(tempId, confirmedMessage);
        } else {
          onTempFailed(tempId);
          toast.error('Erro ao enviar mensagem');
        }
      } catch (error) {
        onTempFailed(tempId);
        toast.error(
          error instanceof Error ? error.message : 'Erro ao enviar mensagem'
        );
      } finally {
        inFlightRef.current.delete(tempId);
      }
    },
    [conversation.id, tenantId, onOptimisticAdd, onTempConfirmed, onTempFailed, onAfterSend]
  );

  return { sendMessage };
}

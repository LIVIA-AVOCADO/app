'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MessageFeedbackButtons } from './message-feedback-buttons';
import { Check, Clock, AlertCircle, CheckCheck } from 'lucide-react';
import type { MessageWithSender, MessageStatus } from '@/types/livechat';

interface MessageItemProps {
  message: MessageWithSender;
  conversationId?: string;
  tenantId?: string;
  isNew?: boolean;
  onRetry?: (messageId: string, content: string) => void;
}

export function MessageItem({ message, conversationId, tenantId, isNew = false, onRetry }: MessageItemProps) {
  const isCustomer = message.sender_type === 'customer';
  const isAttendant = message.sender_type === 'attendant';
  const isIA = message.sender_type === 'ai';

  const senderName = isCustomer
    ? 'Cliente'
    : isIA
      ? 'IA'
      : message.senderUser?.full_name || 'Atendente';

  const initials = senderName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className={cn(
        'flex gap-3 mb-4',
        isCustomer ? 'flex-row' : 'flex-row-reverse',
        isNew && 'animate-in fade-in-0 slide-in-from-bottom-3 duration-200',
        message.status === 'pending' && 'opacity-60 transition-opacity duration-300'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 mt-1">
        <AvatarImage src={message.senderUser?.avatar_url || undefined} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      {/* Balão da mensagem + retry */}
      <div
        className={cn(
          'flex flex-col max-w-[70%]',
          isCustomer ? 'items-start' : 'items-end'
        )}
      >
        <div
          className={cn(
            'rounded-lg px-3 py-2 shadow-sm relative',
            isCustomer
              ? 'bg-white text-foreground border border-border'
              : 'bg-muted text-foreground border border-border'
          )}
        >
          {/* Header: Nome do remetente (não mostrar para IA) */}
          {!isIA && (
            <MessageHeader
              senderName={senderName}
              isIA={isIA}
              isAttendant={isAttendant}
              isCustomer={isCustomer}
            />
          )}

          {/* Conteúdo com horário inline (estilo WhatsApp) */}
          <div className="flex items-end gap-2">
            <p className="text-sm whitespace-pre-wrap flex-1 pr-1">
              {message.content}
            </p>

            {/* Footer: Horário e status inline (não mostrar para IA) */}
            {!isIA && (
              <MessageFooter
                timestamp={message.timestamp}
                status={message.status}
                isAttendant={isAttendant}
              />
            )}
          </div>

          {/* Feedback abaixo da mensagem (apenas para IA) */}
          {isIA && conversationId && tenantId && (
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between">
              <MessageFeedbackButtons
                messageId={message.id}
                conversationId={conversationId}
                tenantId={tenantId}
              />

              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="h-3.5 text-[9px] px-1 py-0">
                  IA
                </Badge>
                <span className="text-[10px] leading-none text-muted-foreground">
                  {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Retry fora do balão, alinhado à direita (apenas atendente com falha) */}
        {message.status === 'failed' && isAttendant && onRetry && (
          <button
            onClick={() => onRetry(message.id, message.content)}
            className="mt-1 text-xs text-destructive underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Componente auxiliar para exibir nome do remetente com badges
 * SRP: Responsabilidade única de renderizar cabeçalho da mensagem
 */
interface MessageHeaderProps {
  senderName: string;
  isIA: boolean;
  isAttendant: boolean;
  isCustomer: boolean;
}

function MessageHeader({ senderName, isIA, isAttendant, isCustomer }: MessageHeaderProps) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 mb-0.5",
      !isCustomer && "justify-end" // Alinha à direita para IA/Atendente
    )}>
      <span
        className={cn(
          'text-xs font-semibold',
          isIA ? 'text-purple-600' : 'text-blue-600'
        )}
      >
        {senderName}
      </span>
      {/* Badge apenas para Atendente (IA terá badge na linha do feedback) */}
      {isAttendant && !isIA && (
        <Badge variant="outline" className="h-3.5 text-[9px] px-1 py-0">
          Atendente
        </Badge>
      )}
    </div>
  );
}

/**
 * Componente auxiliar para exibir horário e status inline
 * SRP: Responsabilidade única de renderizar rodapé da mensagem (estilo WhatsApp)
 */
interface MessageFooterProps {
  timestamp: string;
  status?: MessageStatus | null;
  isAttendant: boolean;
}

function MessageFooter({ timestamp, status, isAttendant }: MessageFooterProps) {
  return (
    <div className="flex items-center gap-1.5 self-end flex-shrink-0 ml-2 pb-0.5">
      <span className="text-[10px] leading-none text-muted-foreground">
        {new Date(timestamp).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
      {isAttendant && <MessageStatusIcon status={status} isInverted={false} />}
    </div>
  );
}

/**
 * Componente auxiliar para exibir ícone de status da mensagem
 * SRP: Responsabilidade única de renderizar status visual
 */
interface MessageStatusIconProps {
  status?: MessageStatus | null;
  isInverted?: boolean; // Para mensagens enviadas (fundo escuro)
}

function MessageStatusIcon({ status, isInverted }: MessageStatusIconProps) {
  // Default para 'sent' se status não existir (backward compatibility)
  const messageStatus = status || 'sent';

  const statusConfig = {
    pending: { icon: Clock, tooltip: 'Enviando...', color: 'muted' },
    sent: { icon: Check, tooltip: 'Enviada', color: 'muted' },
    failed: { icon: AlertCircle, tooltip: 'Falha no envio', color: 'destructive' },
    read: { icon: CheckCheck, tooltip: 'Lida', color: 'blue' },
  };

  const config = statusConfig[messageStatus];
  const Icon = config.icon;

  return (
    <span title={config.tooltip} aria-label={config.tooltip} className="leading-none">
      <Icon
        className={cn(
          'h-3 w-3',
          config.color === 'blue' && 'text-blue-500',
          config.color === 'destructive' && 'text-destructive',
          config.color === 'muted' &&
            (isInverted ? 'text-primary-foreground/70' : 'text-muted-foreground')
        )}
      />
    </span>
  );
}

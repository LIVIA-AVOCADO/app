'use client';

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MessageFeedbackButtons } from './message-feedback-buttons';
import { Check, Clock, AlertCircle, CheckCheck, Reply } from 'lucide-react';
import type { MessageWithSender, MessageStatus, MessageAttachment, QuotedMessagePreview } from '@/types/livechat';
import { AudioPlayer } from './audio-player';
import { createClient } from '@/lib/supabase/client';

interface MessageItemProps {
  message: MessageWithSender;
  conversationId?: string;
  tenantId?: string;
  isNew?: boolean;
  onRetry?: (messageId: string, content: string) => void;
  onReply?: (message: MessageWithSender) => void;
  onQuotedClick?: (messageId: string) => void;
}

export function MessageItem({ message, conversationId, tenantId, isNew = false, onRetry, onReply, onQuotedClick }: MessageItemProps) {
  const isCustomer = message.sender_type === 'customer';
  const isAttendant = message.sender_type === 'attendant';
  const isIA = message.sender_type === 'ai';
  const isSystem = message.sender_type === 'channel';
  const [isHovered, setIsHovered] = useState(false);

  const senderName = isCustomer
    ? 'Cliente'
    : isIA
      ? 'IA'
      : isSystem
        ? 'Enviado pelo sistema'
        : message.senderUser?.full_name || 'Atendente';

  const initials = senderName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const canReply = !message.id.startsWith('temp-');

  return (
    <div
      className={cn(
        'flex gap-3 mb-4 group',
        isCustomer ? 'flex-row' : 'flex-row-reverse',
        isNew && 'animate-in fade-in-0 slide-in-from-bottom-3 duration-200',
        message.id.startsWith('temp-') && message.status === 'pending' && 'opacity-60 transition-opacity duration-300'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
        {/* Wrapper com botão reply fora do balão */}
        <div className="flex items-center gap-1">
        <div
          className={cn(
            'rounded-lg px-3 py-2 shadow-sm',
            isCustomer
              ? 'bg-white text-foreground border border-border'
              : 'bg-muted text-foreground border border-border'
          )}
        >
          {/* Bubble da mensagem citada (reply) */}
          {message.quotedMessage && (
            <QuotedBubble
              quoted={message.quotedMessage}
              isCustomer={isCustomer}
              onQuotedClick={onQuotedClick}
            />
          )}

          {/* Header: Nome do remetente (não mostrar para IA) */}
          {!isIA && (
            <MessageHeader
              senderName={senderName}
              isIA={isIA}
              isAttendant={isAttendant}
              isSystem={isSystem}
              isCustomer={isCustomer}
            />
          )}

          {/* Conteúdo com horário inline (estilo WhatsApp) */}
          <div className="flex items-end gap-2">
            <MessageContent message={message} />

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

          {/* Botão reply à direita do balão (recebidas: lado centro; enviadas: lado avatar) */}
          {canReply && onReply && (
            <button
              onClick={() => onReply(message)}
              className={cn(
                'p-1 rounded-full bg-background border border-border shadow-sm transition-opacity duration-150 text-muted-foreground hover:text-foreground flex-shrink-0',
                isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'
              )}
              title="Responder mensagem"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
          )}
        </div>{/* fim wrapper reply */}

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
 * Bubble da mensagem citada (reply context)
 */
interface QuotedBubbleProps {
  quoted: QuotedMessagePreview;
  isCustomer: boolean;
  onQuotedClick?: (messageId: string) => void;
}

function QuotedBubble({ quoted, isCustomer, onQuotedClick }: QuotedBubbleProps) {
  const senderLabel =
    quoted.sender_type === 'customer'
      ? 'Cliente'
      : quoted.sender_type === 'ai'
        ? 'IA'
        : quoted.senderUser?.full_name || 'Atendente';

  const isClickable = !!onQuotedClick;

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? () => onQuotedClick(quoted.id) : undefined}
      onKeyDown={isClickable ? (e) => e.key === 'Enter' && onQuotedClick(quoted.id) : undefined}
      className={cn(
        'mb-1.5 rounded-md px-2.5 py-1.5 border-l-2 bg-black/5 dark:bg-white/5 transition-colors',
        isCustomer ? 'border-blue-400' : 'border-muted-foreground/50',
        isClickable
          ? 'cursor-pointer hover:bg-black/10 dark:hover:bg-white/10'
          : 'cursor-default'
      )}
    >
      <p className={cn(
        'text-[11px] font-semibold mb-0.5',
        isCustomer ? 'text-blue-600' : 'text-muted-foreground'
      )}>
        {senderLabel}
      </p>
      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {quoted.content || '—'}
      </p>
    </div>
  );
}

/**
 * Componente auxiliar para renderizar conteúdo da mensagem
 * SRP: Responsabilidade única de renderizar o corpo da mensagem por tipo
 *
 * Para mensagens de áudio recebidas via Realtime (sem attachment no payload),
 * faz fetch do attachment automaticamente pelo message_id.
 */
function MessageContent({ message }: { message: MessageWithSender }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messageType = (message as any).message_type ?? 'text';

  const [attachment, setAttachment] = useState<MessageAttachment | null>(
    message.attachment ?? null
  );
  const [loadingAttachment, setLoadingAttachment] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transcriptionStatus = (message as any).transcription_status ?? 'completed';
  const hasTranscription =
    transcriptionStatus === 'completed' &&
    message.content &&
    !message.content.startsWith('[');

  useEffect(() => {
    // Só busca se for áudio, sem attachment, e não for mensagem temporária
    if (
      messageType !== 'audio' ||
      attachment !== null ||
      !message.id ||
      message.id.startsWith('temp-')
    ) return;

    setLoadingAttachment(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('message_attachments')
      .select('id, attachment_type, storage_bucket, storage_path, file_name, mime_type, file_size_bytes, duration_ms')
      .eq('message_id', message.id)
      .single()
      .then(({ data }: { data: MessageAttachment | null }) => {
        setAttachment(data);
        setLoadingAttachment(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, messageType]);

  if (messageType === 'audio') {
    if (loadingAttachment) {
      return (
        <p className="text-sm text-muted-foreground italic flex-1 pr-1">
          Carregando áudio...
        </p>
      );
    }
    if (attachment?.storage_path) {
      const src = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${attachment.storage_bucket}/${attachment.storage_path}`;
      return (
        <div className="flex flex-col gap-1.5 flex-1">
          <AudioPlayer key={attachment.id} src={src} durationMs={attachment.duration_ms} />
          {hasTranscription && (
            <>
              <button
                onClick={() => setShowTranscription((v) => !v)}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors text-left underline underline-offset-2 decoration-dotted"
              >
                {showTranscription ? 'Ocultar transcrição' : 'Ver transcrição'}
              </button>
              {showTranscription && (
                <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-1.5">
                  {message.content}
                </p>
              )}
            </>
          )}
        </div>
      );
    }
    return (
      <p className="text-sm text-muted-foreground italic flex-1 pr-1">
        Áudio indisponível
      </p>
    );
  }

  return (
    <p className="text-sm whitespace-pre-wrap flex-1 pr-1">
      {message.content}
    </p>
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
  isSystem: boolean;
  isCustomer: boolean;
}

function MessageHeader({ senderName, isIA, isAttendant, isSystem, isCustomer }: MessageHeaderProps) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 mb-0.5",
      !isCustomer && "justify-end" // Alinha à direita para IA/Atendente
    )}>
      <span
        className={cn(
          'text-xs font-semibold',
          isIA ? 'text-purple-600' : isSystem ? 'text-muted-foreground' : 'text-blue-600'
        )}
      >
        {senderName}
      </span>
      {/* Badge apenas para Atendente humano (IA terá badge na linha do feedback; sistema não mostra badge) */}
      {isAttendant && !isIA && !isSystem && (
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

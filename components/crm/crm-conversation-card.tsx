'use client';

import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Bot, User } from 'lucide-react';
import { formatMessagePreview } from '@/lib/utils/contact-list';
import { RelativeTime } from '@/components/ui/relative-time';
import { getContactDisplayName } from '@/lib/utils/contact-helpers';
import type { CRMConversationCardProps } from '@/types/crm';
import { cn } from '@/lib/utils';

/**
 * CRMConversationCard - Card de preview de conversa no Kanban
 *
 * Princípios SOLID:
 * - Single Responsibility: Apenas renderiza um card de conversa
 * - Open/Closed: Extensível via props, fechado para modificação
 * - Liskov Substitution: Pode ser usado em qualquer lista de cards
 *
 * Features:
 * - Preview da última mensagem (truncado)
 * - Timestamp relativo (há 5min, há 2h)
 * - Badge de status (Ativa, Aguardando, Encerrada)
 * - Ícone IA ativa/pausada
 * - Click navega para livechat
 */
export function CRMConversationCard({ conversation }: CRMConversationCardProps) {
  const router = useRouter();

  // Buscar última mensagem (pode não existir)
  const lastMessageContent = conversation.lastMessage?.content || 'Sem mensagens';
  const lastMessageTimestamp = conversation.last_message_at || conversation.created_at;

  // Determinar ícone: Bot se IA ativa, User caso contrário
  const Icon = conversation.ia_active ? Bot : User;

  // Badge variant baseado no status + ia_active
  const getStatusConfig = () => {
    if (conversation.status === 'closed') {
      return {
        variant: 'outline' as const,
        label: 'Encerrada',
        className: 'bg-gray-500',
      };
    }
    // status === 'open' (único status ativo agora)
    if (conversation.ia_active) {
      return {
        variant: 'default' as const,
        label: 'IA Ativa',
        className: 'bg-green-500',
      };
    } else {
      return {
        variant: 'default' as const,
        label: 'Modo Manual',
        className: 'bg-blue-500',
      };
    }
  };

  const status = getStatusConfig();

  // Usar função utilitária para obter nome de exibição com fallback
  const displayName = getContactDisplayName(
    conversation.contact.name,
    conversation.contact.phone
  );

  const handleClick = () => {
    router.push(`/inbox?conversation=${conversation.id}`);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'p-3 border rounded-lg cursor-pointer',
        'transition-all duration-200',
        'hover:border-primary hover:shadow-md hover:scale-[1.02]',
        'bg-card'
      )}
    >
      {/* Nome do contato */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium truncate">{displayName}</h4>
      </div>

      {/* Preview da mensagem */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
        {formatMessagePreview(lastMessageContent, 80)}
      </p>

      {/* Footer: Ícone + Timestamp | Badge Status */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" />
          <RelativeTime timestamp={lastMessageTimestamp} />
        </div>

        <Badge variant={status.variant} className={cn('text-[10px] px-2 py-0', status.className)}>
          {status.label}
        </Badge>
      </div>
    </div>
  );
}

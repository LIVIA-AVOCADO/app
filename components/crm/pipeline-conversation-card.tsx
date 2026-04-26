'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useRouter } from 'next/navigation';
import { Bot, User, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { RelativeTime } from '@/components/ui/relative-time';
import { getContactDisplayName } from '@/lib/utils/contact-helpers';
import { formatMessagePreview } from '@/lib/utils/contact-list';
import { cn } from '@/lib/utils';
import type { ConversationWithPipelineAndContact } from '@/types/crm';

interface Props {
  conversation: ConversationWithPipelineAndContact;
}

export function PipelineConversationCard({ conversation }: Props) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: conversation.id,
    data: { conversation },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const Icon = conversation.ia_active ? Bot : User;
  const displayName = getContactDisplayName(conversation.contact.name, conversation.contact.phone);
  const lastMessageContent = conversation.last_message_at ? '' : 'Sem mensagens';
  const timestamp = conversation.last_message_at || conversation.created_at;

  const statusConfig = (() => {
    if (conversation.status === 'closed') return { label: 'Encerrada', className: 'bg-gray-500' };
    if (conversation.ia_active) return { label: 'IA Ativa', className: 'bg-green-500' };
    return { label: 'Manual', className: 'bg-blue-500' };
  })();

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    e.stopPropagation();
    router.push(`/inbox?conversation=${conversation.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        'p-3 border rounded-lg bg-card select-none',
        'transition-shadow duration-150',
        'hover:border-primary hover:shadow-md',
        isDragging && 'shadow-xl ring-2 ring-primary/50'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-medium truncate">{displayName}</span>
        <Badge className={cn('text-[10px] px-2 py-0 flex-shrink-0', statusConfig.className)}>
          {statusConfig.label}
        </Badge>
      </div>

      {lastMessageContent && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {formatMessagePreview(lastMessageContent, 80)}
        </p>
      )}

      {conversation.deal_value != null && (
        <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 mb-2">
          <DollarSign className="h-3 w-3" />
          <span>{conversation.deal_currency} {conversation.deal_value.toFixed(2)}</span>
        </div>
      )}

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        <RelativeTime timestamp={timestamp} />
      </div>
    </div>
  );
}

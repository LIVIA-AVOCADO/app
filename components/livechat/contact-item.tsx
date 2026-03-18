'use client';

import { memo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  formatMessagePreview,
  getConversationLastTimestamp,
} from '@/lib/utils/contact-list';
import { RelativeTime } from '@/components/ui/relative-time';
import {
  getContactFirstName,
  getContactInitials,
} from '@/lib/utils/contact-helpers';
import type { ConversationWithContact } from '@/types/livechat';
import type { Tag } from '@/types/database-helpers';
import { TagBadge } from './tag-badge';
import { MoreVertical, BellOff, XCircle, Tag as TagIcon, Check } from 'lucide-react';
import {
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';

interface ContactItemProps {
  conversation: ConversationWithContact;
  isSelected?: boolean;
  onClick?: () => void;
  onMarkUnread?: (conversationId: string) => void;
  onClose?: (conversationId: string) => void;
  onTagToggle?: (conversationId: string, tagId: string, isRemoving: boolean) => void;
  allTags?: Tag[];
}

function ContactItemComponent({
  conversation,
  isSelected = false,
  onClick,
  onMarkUnread,
  onClose,
  onTagToggle,
  allTags = [],
}: ContactItemProps) {
  const { contact, lastMessage, status, ia_active, category, conversation_tags, has_unread, unread_count } = conversation;

  const messagePreview = formatMessagePreview(lastMessage?.content);
  const lastTimestamp = getConversationLastTimestamp(conversation);

  const displayName = getContactFirstName(contact.name, contact.phone);
  const initials = getContactInitials(contact.name, contact.phone);

  // Extract all tags from conversation
  const conversationTagList = conversation_tags?.map(ct => ct.tag).filter(tag => tag && tag.id) || [];
  const conversationTagIds = new Set(conversationTagList.map(t => t.id));

  const getStatusDisplay = () => {
    if (status === 'closed') {
      return { label: 'Encerrada', badgeVariant: 'outline' as const };
    }
    if (ia_active) {
      return { label: 'IA Ativa', badgeVariant: 'success' as const };
    } else {
      return { label: 'Modo Manual', badgeVariant: 'info' as const };
    }
  };

  const statusDisplay = getStatusDisplay();
  const isClosed = status === 'closed';

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all duration-200 hover:bg-accent/60 hover:shadow-md hover:-translate-y-px group relative',
        isSelected
          ? 'border border-primary/50 bg-primary/5 shadow-md shadow-primary/10'
          : 'border-0'
      )}
      onClick={onClick}
    >
      {/* Botão ⋮ — visível no hover ou quando selecionado */}
      {(onMarkUnread || onClose) && (
        <div
          className={cn(
            'absolute top-2 right-2 transition-opacity duration-150',
            isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                aria-label="Mais ações"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {/* Adicionar tag */}
              {onTagToggle && allTags.length > 0 && !isClosed && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <TagIcon className="h-4 w-4 mr-2" />
                    Adicionar tag
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-48 max-h-64 overflow-y-auto">
                    {allTags.map((tag) => {
                      const isAssigned = conversationTagIds.has(tag.id);
                      return (
                        <DropdownMenuItem
                          key={tag.id}
                          onClick={() => onTagToggle(conversation.id, tag.id, isAssigned)}
                          className="flex items-center justify-between"
                        >
                          <TagBadge tag={tag} size="sm" />
                          {isAssigned && <Check className="h-3.5 w-3.5 text-primary ml-2 shrink-0" />}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {onMarkUnread && !has_unread && !isClosed && (
                <DropdownMenuItem onClick={() => onMarkUnread(conversation.id)}>
                  <BellOff className="h-4 w-4 mr-2" />
                  Marcar como não lida
                </DropdownMenuItem>
              )}

              {onClose && !isClosed && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onClose(conversation.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Encerrar conversa
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="flex gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">{displayName}</span>
              {/* Badge de mensagens não lidas - só aparece no modo manual */}
              {!ia_active && has_unread && unread_count > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-green-500 rounded-full">
                  {unread_count > 99 ? '99+' : unread_count}
                </span>
              )}
            </div>
            <RelativeTime
              timestamp={lastTimestamp}
              className="text-xs text-muted-foreground shrink-0 ml-2"
            />
          </div>

          <p className="text-sm text-muted-foreground truncate mb-2">
            {messagePreview}
          </p>

          {/* All tags (including category) - shown after message preview */}
          {(category || conversationTagList.length > 0) && (
            <div className="flex flex-wrap items-start gap-1 mb-2 min-h-fit">
              {category && <TagBadge tag={category} size="sm" />}
              {conversationTagList.filter(tag => tag.id !== category?.id).map((tag) => (
                <TagBadge key={tag.id} tag={tag} size="sm" />
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Badge
              variant={statusDisplay.badgeVariant}
              className="transition-colors duration-300"
            >
              {statusDisplay.label}
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Custom comparison function for memo - re-render only when relevant data changes
function arePropsEqual(prevProps: ContactItemProps, nextProps: ContactItemProps): boolean {
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.onMarkUnread !== nextProps.onMarkUnread) return false;
  if (prevProps.onClose !== nextProps.onClose) return false;
  if (prevProps.onTagToggle !== nextProps.onTagToggle) return false;
  if (prevProps.allTags !== nextProps.allTags) return false;

  const prevConv = prevProps.conversation;
  const nextConv = nextProps.conversation;

  return (
    prevConv.id === nextConv.id &&
    prevConv.last_message_at === nextConv.last_message_at &&
    prevConv.status === nextConv.status &&
    prevConv.ia_active === nextConv.ia_active &&
    prevConv.has_unread === nextConv.has_unread &&
    prevConv.unread_count === nextConv.unread_count &&
    prevConv.lastMessage?.content === nextConv.lastMessage?.content &&
    prevConv.category?.id === nextConv.category?.id &&
    (prevConv.conversation_tags?.map(ct => ct.tag?.id).join(',') || '') ===
    (nextConv.conversation_tags?.map(ct => ct.tag?.id).join(',') || '')
  );
}

export const ContactItem = memo(ContactItemComponent, arePropsEqual);

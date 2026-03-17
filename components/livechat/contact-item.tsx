'use client';

import { memo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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
import { TagBadge } from './tag-badge';

interface ContactItemProps {
  conversation: ConversationWithContact;
  isSelected?: boolean;
  onClick?: () => void;
}

function ContactItemComponent({
  conversation,
  isSelected = false,
  onClick,
}: ContactItemProps) {
  const { contact, lastMessage, status, ia_active, category, conversation_tags, has_unread, unread_count } = conversation;

  // Use utilities for formatting (Single Responsibility)
  const messagePreview = formatMessagePreview(lastMessage?.content);
  const lastTimestamp = getConversationLastTimestamp(conversation);

  // Use utility functions for display name and initials with fallback
  const displayName = getContactFirstName(contact.name, contact.phone);
  const initials = getContactInitials(contact.name, contact.phone);

  // Extract all tags from conversation (including category which will be shown after preview)
  const allTags = conversation_tags?.map(ct => ct.tag).filter(tag => tag && tag.id) || [];

  // Determine label and badge variant based on status + ia_active
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

  return (
    <Card
      className={cn(
        'p-4 cursor-pointer transition-all duration-200 hover:bg-accent/60 hover:shadow-md hover:-translate-y-px',
        isSelected
          ? 'border border-primary/50 bg-primary/5 shadow-md shadow-primary/10'
          : 'border-0'
      )}
      onClick={onClick}
    >
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
          {(category || allTags.length > 0) && (
            <div className="flex flex-wrap items-start gap-1 mb-2 min-h-fit">
              {category && <TagBadge tag={category} size="sm" />}
              {allTags.filter(tag => tag.id !== category?.id).map((tag) => (
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
  // Always re-render if selection state changes
  if (prevProps.isSelected !== nextProps.isSelected) {
    return false;
  }

  const prevConv = prevProps.conversation;
  const nextConv = nextProps.conversation;

  // Compare essential fields
  return (
    prevConv.id === nextConv.id &&
    prevConv.last_message_at === nextConv.last_message_at &&
    prevConv.status === nextConv.status &&
    prevConv.ia_active === nextConv.ia_active &&
    prevConv.has_unread === nextConv.has_unread &&
    prevConv.unread_count === nextConv.unread_count &&
    prevConv.lastMessage?.content === nextConv.lastMessage?.content &&
    prevConv.category?.id === nextConv.category?.id &&
    // Compare tags by joining IDs
    (prevConv.conversation_tags?.map(ct => ct.tag?.id).join(',') || '') ===
    (nextConv.conversation_tags?.map(ct => ct.tag?.id).join(',') || '')
  );
}

export const ContactItem = memo(ContactItemComponent, arePropsEqual);

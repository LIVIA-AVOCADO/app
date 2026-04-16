'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RelativeTime } from '@/components/ui/relative-time';
import { cn } from '@/lib/utils';
import { getContactFirstName, getContactInitials } from '@/lib/utils/contact-helpers';
import type { MessageSearchResult } from '@/types/livechat';

interface HighlightedSnippetProps {
  text: string;
  query: string;
}

function HighlightedSnippet({ text, query }: HighlightedSnippetProps) {
  if (!query || query.length < 3) return <span>{text}</span>;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-px not-italic">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

interface MessageSearchResultItemProps {
  result: MessageSearchResult;
  query: string;
  isSelected?: boolean;
  onActivate: (conversationId: string) => void;
}

export function MessageSearchResultItem({
  result,
  query,
  isSelected = false,
  onActivate,
}: MessageSearchResultItemProps) {
  const displayName = getContactFirstName(result.contact_name, result.contact_phone);
  const initials = getContactInitials(result.contact_name, result.contact_phone);

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg cursor-pointer transition-colors',
        'hover:bg-accent/60',
        isSelected && 'bg-primary/5 ring-1 ring-primary/30'
      )}
      onClick={() => onActivate(result.conversation_id)}
    >
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-sm font-medium truncate">{displayName}</span>
          <RelativeTime
            timestamp={result.message_timestamp}
            className="text-xs text-muted-foreground shrink-0 ml-2"
          />
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          <HighlightedSnippet text={result.message_snippet} query={query} />
        </p>
      </div>
    </div>
  );
}

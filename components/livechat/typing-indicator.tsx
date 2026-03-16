'use client';

import { cn } from '@/lib/utils';

interface TypingIndicatorProps {
  isVisible: boolean;
  className?: string;
}

export function TypingIndicator({ isVisible, className }: TypingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className={cn('flex gap-3 mb-2', className)}>
      {/* Avatar placeholder para alinhar com mensagens do cliente */}
      <div className="h-8 w-8 mt-1 flex-shrink-0" />

      <div className="bg-white border border-border rounded-lg px-3 py-2.5 shadow-sm flex items-center gap-1">
        <span
          className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1.2s' }}
        />
        <span
          className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
          style={{ animationDelay: '200ms', animationDuration: '1.2s' }}
        />
        <span
          className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce"
          style={{ animationDelay: '400ms', animationDuration: '1.2s' }}
        />
      </div>
    </div>
  );
}

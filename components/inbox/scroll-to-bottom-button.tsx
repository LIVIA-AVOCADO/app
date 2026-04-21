'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollToBottomButtonProps {
  show: boolean;
  unreadCount: number;
  onClick: () => void;
}

export function ScrollToBottomButton({
  show,
  unreadCount,
  onClick,
}: ScrollToBottomButtonProps) {
  if (!show) return null;

  return (
    <div className="absolute bottom-24 right-6 z-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Button
        onClick={onClick}
        size="icon"
        className={cn(
          'h-12 w-12 rounded-full shadow-lg',
          'hover:scale-110 transition-transform'
        )}
        variant="default"
      >
        <ArrowDown className="h-5 w-5" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full p-0 flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>
    </div>
  );
}

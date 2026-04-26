'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { PipelineConversationCard } from './pipeline-conversation-card';
import type { PipelineKanbanColumnProps } from '@/types/crm';

export function PipelineKanbanColumn({ stage, conversations, currentFilter }: PipelineKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  const filtered = conversations.filter((conv) => {
    if (currentFilter === 'ia') return conv.ia_active && conv.status !== 'closed';
    if (currentFilter === 'manual') return !conv.ia_active && conv.status !== 'closed';
    if (currentFilter === 'closed') return conv.status === 'closed';
    return true;
  });

  const count = filtered.length;

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Column header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg border border-b-0"
        style={{ borderColor: stage.color, backgroundColor: stage.color + '22' }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: stage.color }}
        />
        <span className="text-sm font-semibold truncate flex-1">{stage.name}</span>
        <span className="text-xs text-muted-foreground ml-auto bg-background/60 px-1.5 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[120px] rounded-b-lg border border-t-0 p-2 space-y-2',
          'transition-colors duration-150',
          isOver ? 'bg-primary/10 border-primary/50' : 'bg-card/50 border-border'
        )}
      >
        {filtered.map((conv) => (
          <PipelineConversationCard key={conv.id} conversation={conv} />
        ))}

        {count === 0 && (
          <div className={cn(
            'flex items-center justify-center h-16 rounded text-xs text-muted-foreground',
            isOver && 'border-2 border-dashed border-primary/40'
          )}>
            {isOver ? 'Soltar aqui' : 'Vazio'}
          </div>
        )}
      </div>
    </div>
  );
}

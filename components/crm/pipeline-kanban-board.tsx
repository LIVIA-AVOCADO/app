'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CRMFilters } from './crm-filters';
import { PipelineKanbanColumn } from './pipeline-kanban-column';
import { PipelineConversationCard } from './pipeline-conversation-card';
import type { PipelineKanbanBoardProps, ConversationWithPipelineAndContact, CRMStatusFilter } from '@/types/crm';

export function PipelineKanbanBoard({
  initialStages,
  initialConversations,
}: PipelineKanbanBoardProps) {
  const [conversations, setConversations] = useState<ConversationWithPipelineAndContact[]>(initialConversations);
  const [activeConv, setActiveConv] = useState<ConversationWithPipelineAndContact | null>(null);
  const [currentFilter, setCurrentFilter] = useState<CRMStatusFilter>('all');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Add a virtual "Sem estágio" column for unassigned conversations
  const stages = useMemo(() => [
    { id: '__unassigned__', tenant_id: '', name: 'Sem estágio', color: '#94a3b8', display_order: -1, is_closed: false, is_won: false, created_at: '' },
    ...initialStages,
  ], [initialStages]);

  const conversationsPerStage = useMemo(() => {
    const map: Record<string, ConversationWithPipelineAndContact[]> = {};
    for (const stage of stages) map[stage.id] = [];
    for (const conv of conversations) {
      const key = conv.pipeline_stage_id ?? '__unassigned__';
      if (!map[key]) map[key] = [];
      map[key].push(conv);
    }
    return map;
  }, [conversations, stages]);

  const statusCounts = useMemo(() => {
    const counts = { open: 0, paused: 0, closed: 0, all: conversations.length };
    conversations.forEach((c) => {
      if (c.status === 'closed') counts.closed++;
      else if (c.ia_active) counts.open++;
      else counts.paused++;
    });
    return counts;
  }, [conversations]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveConv(null);
    if (!over || active.id === over.id) return;

    const convId = active.id as string;
    const newStageId = over.id === '__unassigned__' ? null : (over.id as string);

    // Optimistic update
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId
          ? { ...c, pipeline_stage_id: newStageId, stage_moved_at: new Date().toISOString() }
          : c
      )
    );

    try {
      await fetch('/api/crm/pipeline/move', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: convId, stage_id: newStageId }),
      });
    } catch {
      // Revert on error
      setConversations(initialConversations);
    }
  }, [initialConversations]);

  const activeDragConv = activeConv;

  return (
    <div className="flex flex-col h-full min-w-0 bg-background">
      <div className="p-4 border-b border-border space-y-4 flex-shrink-0 bg-card">
        <div>
          <h1 className="text-2xl font-bold">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Arraste conversas entre os estágios do funil
          </p>
        </div>
        <CRMFilters
          currentFilter={currentFilter}
          onFilterChange={setCurrentFilter}
          statusCounts={statusCounts}
        />
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => {
          const conv = conversations.find((c) => c.id === active.id);
          if (conv) setActiveConv(conv);
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="scrollbar-themed flex-1 overflow-x-auto overflow-y-hidden p-4">
          <div className="flex gap-3 min-w-max h-full items-start">
            {stages.map((stage) => (
              <PipelineKanbanColumn
                key={stage.id}
                stage={stage}
                conversations={conversationsPerStage[stage.id] ?? []}
                currentFilter={currentFilter}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeDragConv && (
            <div className="w-72 rotate-2">
              <PipelineConversationCard conversation={activeDragConv} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

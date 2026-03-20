'use client';

import { useState, useMemo } from 'react';
import { CRMFilters } from './crm-filters';
import { CRMKanbanColumn } from './crm-kanban-column';
import type { CRMKanbanBoardProps, CRMStatusFilter } from '@/types/crm';

/**
 * CRMKanbanBoard - Board principal do CRM com colunas Kanban
 *
 * Princípios SOLID:
 * - Single Responsibility: Orquestra componentes CRM e gerencia estado
 * - Open/Closed: Extensível via novos componentes, fechado para modificação
 * - Dependency Inversion: Componentes injetados via props
 *
 * Features:
 * - Grid de colunas (uma por tag)
 * - Filtro de status global
 * - Contadores dinâmicos
 * - Scroll horizontal automático
 * - Realtime updates (via hook - TODO)
 *
 * @param initialTags - Tags do tenant (ordenadas)
 * @param initialConversations - Conversas com tags e contato
 * @param tenantId - ID do tenant para realtime
 */
export function CRMKanbanBoard({
  initialTags,
  initialConversations,
  tenantId: _tenantId,
}: CRMKanbanBoardProps) {
  // Estado do filtro de status
  const [currentFilter, setCurrentFilter] = useState<CRMStatusFilter>('all');

  // TODO: Integrar hook de realtime
  // const { tags, conversations } = useCRMRealtime({
  //   tenantId,
  //   initialTags,
  //   initialConversations,
  // });

  // Por enquanto, usar dados iniciais
  const tags = initialTags;
  const conversations = initialConversations;

  // Calcular contadores de status (consolidados)
  const statusCounts = useMemo(() => {
    const counts = {
      open: 0, // IA (ia_active=true)
      paused: 0, // Manual (ia_active=false, status não closed)
      closed: 0,
      all: conversations.length,
    };

    conversations.forEach((conv) => {
      if (conv.status === 'closed') {
        counts.closed++;
      } else if (conv.ia_active) {
        counts.open++; // IA Ativa
      } else {
        counts.paused++; // Modo Manual (inclui open e paused)
      }
    });

    return counts;
  }, [conversations]);

  return (
    <div className="flex flex-col h-full min-w-0 bg-background">
      {/* Header com título e filtros */}
      <div className="p-4 border-b border-border space-y-4 flex-shrink-0 bg-card">
        <div>
          <h1 className="text-2xl font-bold">
            CRM{' '}
            <span className="text-sm font-normal text-on-surface-variant">
              BETA
            </span>
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Gerencie conversas por tags
          </p>
        </div>

        <CRMFilters
          currentFilter={currentFilter}
          onFilterChange={setCurrentFilter}
          statusCounts={statusCounts}
        />
      </div>

      {/* Grid de colunas com scroll horizontal */}
      <div className="scrollbar-themed flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-4 min-w-max h-full">
          {tags.length === 0 ? (
            <div className="flex items-center justify-center w-full h-full">
              <div className="text-center space-y-2">
                <p className="text-lg font-semibold">
                  Nenhuma tag encontrada
                </p>
                <p className="text-sm text-muted-foreground">
                  Crie tags para organizar suas conversas no CRM
                </p>
              </div>
            </div>
          ) : (
            tags.map((tag) => (
              <CRMKanbanColumn
                key={tag.id}
                tag={tag}
                conversations={conversations}
                currentFilter={currentFilter}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import type { Conversation, Contact, Tag } from './database-helpers';

// ── Pipeline ──────────────────────────────────────────────────────────────────

export interface PipelineStage {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  display_order: number;
  is_closed: boolean;
  is_won: boolean;
  created_at: string;
}

export interface ConversationWithPipelineAndContact extends Conversation {
  contact: Contact;
  pipeline_stage_id: string | null;
  deal_value: number | null;
  deal_currency: string;
  stage_moved_at: string | null;
}

export interface PipelineKanbanBoardProps {
  initialStages: PipelineStage[];
  initialConversations: ConversationWithPipelineAndContact[];
  tenantId: string;
}

export interface PipelineKanbanColumnProps {
  stage: PipelineStage;
  conversations: ConversationWithPipelineAndContact[];
  currentFilter: CRMStatusFilter;
  isOver?: boolean;
}

// ── Contact fields ────────────────────────────────────────────────────────────

export interface ContactFieldDefinition {
  id: string;
  tenant_id: string;
  field_key: string;
  field_label: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  options: string[] | null;
  is_required: boolean;
  display_order: number;
  created_at: string;
}

export interface ContactFieldValue {
  contact_id: string;
  tenant_id: string;
  field_key: string;
  value: string | null;
  updated_at: string;
}

export interface ContactNote {
  id: string;
  contact_id: string;
  tenant_id: string;
  content: string;
  created_by: string | null;
  created_at: string;
}

/**
 * CRM Types - Feature Kanban Board
 *
 * Princípios SOLID:
 * - Single Responsibility: Tipos específicos para o módulo CRM
 * - Interface Segregation: Interfaces focadas e específicas
 */

/**
 * Conversa com suas tags e informações do contato
 * Usado no KanbanBoard para renderizar cards
 */
export interface ConversationWithTagsAndContact extends Conversation {
  contact: Contact;
  conversation_tags: Array<{
    tag: Tag;
  }>;
  lastMessage?: {
    content: string;
    timestamp: string;
  } | null;
}

/**
 * Estrutura de uma coluna no Kanban
 * Cada coluna representa uma tag
 */
export interface KanbanColumn {
  tag: Tag;
  conversations: ConversationWithTagsAndContact[];
  count: number;
}

/**
 * Filtros de status para o CRM
 * Define quais conversas são exibidas
 */
export type CRMStatusFilter = 'ia' | 'manual' | 'closed' | 'all';

/**
 * Props para componentes CRM
 */
export interface CRMFiltersProps {
  currentFilter: CRMStatusFilter;
  onFilterChange: (filter: CRMStatusFilter) => void;
  statusCounts: {
    open: number; // Mantido para compatibilidade, mas representa "ia"
    paused: number; // Mantido para compatibilidade, mas representa "manual"
    closed: number;
    all: number;
  };
}

export interface CRMKanbanBoardProps {
  initialTags: Tag[];
  initialConversations: ConversationWithTagsAndContact[];
  tenantId: string;
}

export interface CRMKanbanColumnProps {
  tag: Tag;
  conversations: ConversationWithTagsAndContact[];
  currentFilter: CRMStatusFilter;
}

export interface CRMConversationCardProps {
  conversation: ConversationWithTagsAndContact;
}

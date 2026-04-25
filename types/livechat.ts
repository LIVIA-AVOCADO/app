/**
 * Livechat Types - Tipos compostos específicos do Livechat
 */

import type {
  Contact,
  Conversation,
  Message,
  User,
  Tag,
} from './database-helpers';

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Status de entrega da mensagem
 */
export type MessageStatus = 'pending' | 'sent' | 'failed' | 'read';

/**
 * Contagens das abas do livechat (agregação no DB; não depende do limite de linhas da lista).
 */
export interface LivechatTabStatusCounts {
  ia: number;
  manual: number;
  closed: number;
  important: number;
  unreadManual: number;
}

// ============================================================================
// COMPOSITE TYPES
// ============================================================================

/**
 * Contato com suas conversas ativas
 */
export interface ContactWithConversations extends Contact {
  activeConversations: ConversationWithLastMessage[];
}

/**
 * Conversa com última mensagem
 */
export interface ConversationWithLastMessage extends Conversation {
  lastMessage: Message | null;
}

/**
 * Tag de conversa com informações da tag
 */
export interface ConversationTagWithTag {
  tag: Tag;
}

/**
 * Conversa com dados do contato e última mensagem
 *
 * NOVO MODELO (2025-11-22): Cada card na UI representa uma CONVERSA (não um contato).
 * Mesmo contato pode ter múltiplos cards se tiver múltiplas conversas.
 *
 * Ver: docs/LIVECHAT_CONVERSATION_CARDS_REFACTOR.md
 */
export interface ConversationChannel {
  id: string;
  name: string;
  identification_number: string | null;
  channel_provider_id: string | null;
}

export interface ConversationWithContact extends Conversation {
  contact: Pick<Contact, 'id' | 'name' | 'phone' | 'email' | 'status'> & {
    is_muted?: boolean;
    mute_reason?: string | null;
  };
  lastMessage: Message | null;
  conversation_tags?: ConversationTagWithTag[];
  category?: Tag | null;
  channel?: ConversationChannel | null;
  // Fase 3 — campos de atribuição (nullable até URA Engine entrar em operação)
  assigned_to?: string | null;
  assigned_at?: string | null;
  team_id?: string | null;
}

/** Patch no estado local: `contact` pode ser parcial (ex.: só is_muted). */
export type ConversationWithContactLocalPatch = Omit<
  Partial<ConversationWithContact>,
  'contact'
> & {
  contact?: Partial<ConversationWithContact['contact']>;
};

/**
 * Attachment de mensagem (áudio, imagem, arquivo)
 */
export interface MessageAttachment {
  id: string;
  tenant_id: string;
  conversation_id: string;
  message_id: string;
  attachment_type: 'audio' | 'image' | 'file' | 'video';
  storage_bucket: string;
  storage_path: string;
  file_name: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  duration_ms: number | null;
  provider_media_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Preview da mensagem citada (para exibição no bubble de reply)
 */
export interface QuotedMessagePreview {
  id: string;
  content: string;
  sender_type: string;
  senderUser?: Pick<User, 'id' | 'full_name' | 'avatar_url'> | null;
}

/**
 * Mensagem com informações do remetente
 */
export interface MessageWithSender extends Message {
  senderUser?: Pick<User, 'id' | 'full_name' | 'avatar_url'> | null;
  attachment?: MessageAttachment | null;
  /** Mensagem citada (resolvida em runtime a partir de quoted_message_id) */
  quotedMessage?: QuotedMessagePreview | null;
}

/**
 * Conversa completa com contato e mensagens
 */
export interface ConversationWithDetails extends Conversation {
  contact: Contact;
  messages: MessageWithSender[];
}

// ============================================================================
// API PAYLOADS
// ============================================================================

/**
 * Payload para enviar mensagem manual
 */
export interface SendMessagePayload {
  conversationId: string;
  content: string;
  tenantId: string;
  quotedMessageId?: string;
}

/**
 * Payload para pausar IA
 */
export interface PauseIAPayload {
  conversationId: string;
  tenantId: string;
  reason?: string;
}

/**
 * Payload para retomar IA
 */
export interface ResumeIAPayload {
  conversationId: string;
  tenantId: string;
}

/**
 * Payload para usar quick reply
 */
export interface UseQuickReplyPayload {
  quickReplyId: string;
  conversationId: string;
  tenantId: string;
}

// ============================================================================
// FILTERS
// ============================================================================

/**
 * Filtros para listagem de contatos
 */
export interface ContactFilters {
  search?: string; // Busca por nome ou phone
  status?: Contact['status'];
  includeClosedConversations?: boolean; // Se true, inclui conversas encerradas na busca
  limit?: number;
  offset?: number;
}

/**
 * Filtros para listagem de conversas
 */
export interface ConversationFilters {
  search?: string; // Busca por nome ou phone do contato
  status?: Conversation['status']; // 'open' | 'closed'
  categoryId?: string; // Filtrar por categoria específica
  includeClosedConversations?: boolean; // Se true, inclui conversas encerradas
  isImportant?: boolean; // Se true, filtra apenas conversas marcadas como importantes
  limit?: number;
  offset?: number;
}

/**
 * Opções de ordenação da lista de contatos
 */
export interface ContactListSortOptions {
  sortBy: 'last_message' | 'name' | 'status';
  order: 'asc' | 'desc';
}

/**
 * Filtros para listagem de mensagens
 */
export interface MessageFilters {
  conversationId: string;
  limit?: number;
  before?: string; // timestamp
  after?: string; // timestamp
}

// ============================================================================
// UI STATE
// ============================================================================

/**
 * Estado de envio de mensagem
 */
export interface MessageSendState {
  isLoading: boolean;
  error: string | null;
}

/**
 * Estado de controles da conversa
 */
export interface ConversationControlsState {
  isPausingIA: boolean;
  isResumingIA: boolean;
  error: string | null;
}

// ============================================================================
// QUICK REPLIES
// ============================================================================

/**
 * Quick Reply do tenant
 */
export interface QuickReply {
  id: string;
  tenant_id: string;
  emoji: string | null;
  title: string;
  content: string;
  active: boolean;
  usage_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Payload para criar quick reply
 */
export interface QuickReplyCreatePayload {
  emoji?: string | null;
  title: string;
  content: string;
  tenantId: string;
}

/**
 * Payload para atualizar quick reply
 */
export interface QuickReplyUpdatePayload {
  emoji?: string | null;
  title?: string;
  content?: string;
  active?: boolean;
}

/**
 * Payload para incrementar uso de quick reply
 */
export interface QuickReplyUsagePayload {
  quickReplyId: string;
  tenantId: string;
}

// ============================================================================
// MESSAGE FEEDBACK
// ============================================================================

/**
 * Feedback de mensagem da IA
 */
export interface MessageFeedback {
  id: string;
  tenant_id: string;
  message_id: string;
  conversation_id: string;
  rating: 'positive' | 'negative';
  comment: string | null;
  user_id: string;
  created_at: string;
}

/**
 * Payload para criar feedback
 */
export interface MessageFeedbackPayload {
  messageId: string;
  conversationId: string;
  rating: 'positive' | 'negative';
  comment?: string;
  tenantId: string;
}

// ============================================================================
// CONTACT DATA
// ============================================================================

/**
 * Histórico de alteração de dados do contato
 */
export interface ContactDataChange {
  id: string;
  tenant_id: string;
  contact_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: string;
}

/**
 * Payload para atualizar campo do contato (update de campo único)
 */
export interface ContactUpdatePayload {
  contactId: string;
  field: string;
  value: unknown;
  tenantId: string;
}

/**
 * Payload para atualizar múltiplos campos do contato
 */
export interface ContactBulkUpdatePayload {
  name: string;
  email?: string | null;
  cpf?: string | null;
  phone_secondary?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  city?: string | null;
  zip_code?: string | null;
}

// ============================================================================
// FOLLOW UP
// ============================================================================

export interface ConversationFollowup {
  id: string;
  conversation_id: string;
  tenant_id: string;
  scheduled_at: string;
  message: string | null;
  ai_generate: boolean;
  cancel_on_reply: boolean;
  is_done: boolean;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateFollowupPayload {
  conversationId: string;
  tenantId: string;
  scheduledAt: string;       // ISO string
  message?: string | null;
  aiGenerate: boolean;
  cancelOnReply: boolean;
}

// ============================================================================
// MESSAGE SEARCH
// ============================================================================

export interface MessageSearchResult {
  message_id: string;
  conversation_id: string;
  message_snippet: string;
  message_timestamp: string;
  contact_id: string;
  contact_name: string | null;
  contact_phone: string | null;
  conversation_status: string;
}

export interface MessageSearchResponse {
  results: MessageSearchResult[];
  query: string;
  total: number;
}

// ============================================================================
// CATEGORIES / TAGS
// ============================================================================

/**
 * Payload para atualizar categoria de uma conversa
 */
export interface UpdateCategoryPayload {
  conversationId: string;
  categoryId: string | null; // null remove a categoria
  tenantId: string;
}

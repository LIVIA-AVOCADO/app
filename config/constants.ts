/**
 * Constantes centralizadas do projeto LIVIA MVP
 *
 * Este arquivo elimina "magic numbers" espalhados pelo código,
 * melhorando manutenibilidade e seguindo o princípio OCP (Open/Closed).
 */

// ============================================================================
// UI / UX
// ============================================================================

/**
 * Tempo de delay para animações de dialog (ms)
 * Usado para limpar state após animação de saída
 */
export const DIALOG_ANIMATION_DELAY = 150;

/**
 * Tempo de debounce para inputs de busca (ms)
 */
export const SEARCH_DEBOUNCE_DELAY = 300;

/**
 * Tempo de auto-hide para toasts de sucesso (ms)
 */
export const TOAST_SUCCESS_DURATION = 3000;

/**
 * Tempo de auto-hide para toasts de erro (ms)
 */
export const TOAST_ERROR_DURATION = 5000;

// ============================================================================
// Paginação e Limites
// ============================================================================

/**
 * Número máximo de queries exibidas no histórico do Neurocore
 * Limita memória/performance do componente
 */
export const MAX_NEUROCORE_QUERIES = 20;

/**
 * Número máximo de quick replies exibidas na lista "mais usadas"
 */
export const MAX_TOP_QUICK_REPLIES = 3;

/**
 * Número de itens por página em listagens
 */
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Número máximo de tags exibidas antes de mostrar "+N mais"
 */
export const MAX_VISIBLE_TAGS = 3;

// ============================================================================
// Validação de Inputs
// ============================================================================

/**
 * Comprimento mínimo de query no Neurocore (caracteres)
 */
export const MIN_QUERY_LENGTH = 3;

/**
 * Comprimento máximo de query no Neurocore (caracteres)
 */
export const MAX_QUERY_LENGTH = 500;

/**
 * Comprimento mínimo de mensagem no livechat (caracteres)
 */
export const MIN_MESSAGE_LENGTH = 1;

/**
 * Comprimento máximo de mensagem no livechat (caracteres)
 */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * Comprimento máximo de título de synapse (caracteres)
 */
export const MAX_SYNAPSE_TITLE_LENGTH = 200;

/**
 * Comprimento máximo de descrição de synapse (caracteres)
 */
export const MAX_SYNAPSE_DESCRIPTION_LENGTH = 500;

// ============================================================================
// API e Timeouts
// ============================================================================

/**
 * Timeout padrão para requisições API (ms)
 */
export const DEFAULT_API_TIMEOUT = 30000; // 30 segundos

/**
 * Timeout para webhooks n8n (ms)
 */
export const N8N_WEBHOOK_TIMEOUT = 30000; // 30 segundos

/**
 * Intervalo de polling para verificar status (ms)
 */
export const POLLING_INTERVAL = 5000; // 5 segundos

// ============================================================================
// Realtime / WebSocket
// ============================================================================

/**
 * Intervalo de reconnect para Supabase Realtime (ms)
 */
export const REALTIME_RECONNECT_INTERVAL = 3000;

/**
 * Número máximo de tentativas de reconnect
 */
export const MAX_RECONNECT_ATTEMPTS = 5;

// ============================================================================
// Scores e Métricas
// ============================================================================

/**
 * Score mínimo de similaridade para destacar synapse (0-1)
 * Synapses com score >= GOOD são consideradas "boas matches"
 */
export const MIN_GOOD_SIMILARITY_SCORE = 0.7;

/**
 * Score mínimo de similaridade para exibir synapse (0-1)
 * Synapses com score < MIN são filtradas
 */
export const MIN_SIMILARITY_SCORE = 0.3;

// ============================================================================
// Estados e Status
// ============================================================================

/**
 * Estados válidos de conversa
 */
export const CONVERSATION_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
} as const;

/**
 * Estados válidos de synapse
 */
export const SYNAPSE_STATUS = {
  DRAFT: 'draft',
  INDEXING: 'indexing',
  PUBLISHED: 'published',
  ERROR: 'error',
} as const;

/**
 * Tipos de remetente de mensagem
 */
export const MESSAGE_SENDER_TYPE = {
  CUSTOMER: 'customer',
  AGENT: 'agent',
  AI: 'ai',
  SYSTEM: 'system',
} as const;

// ============================================================================
// Confirmações de Segurança
// ============================================================================

/**
 * Texto que deve ser digitado para confirmar pausa global da IA
 */
export const AI_PAUSE_CONFIRMATION_TEXT = 'PAUSAR';

/**
 * Texto que deve ser digitado para confirmar exclusão de base de conhecimento
 */
export const DELETE_BASE_CONFIRMATION_TEXT = 'EXCLUIR';

// ============================================================================
// Type Exports (para TypeScript)
// ============================================================================

export type ConversationStatus =
  (typeof CONVERSATION_STATUS)[keyof typeof CONVERSATION_STATUS];
export type SynapseStatus =
  (typeof SYNAPSE_STATUS)[keyof typeof SYNAPSE_STATUS];
export type MessageSenderType =
  (typeof MESSAGE_SENDER_TYPE)[keyof typeof MESSAGE_SENDER_TYPE];

import type { ConversationWithContact } from '@/types/livechat';
import type { Contact, Message } from '@/types/database-helpers';

/**
 * Fixtures para testes do Livechat
 *
 * Dados mockados que representam o estado real do sistema.
 */

// ===== CONTATOS =====

export const mockContact: Contact = {
  id: 'contact-1',
  tenant_id: 'tenant-1',
  name: 'João Silva',
  phone: '5511999999999',
  email: 'joao@example.com',
  status: 'open',
  created_at: '2025-11-23T09:00:00Z',
  updated_at: '2025-11-23T09:00:00Z',
  last_interaction_at: '2025-11-23T09:00:00Z',
  // Campos opcionais
  address_complement: null,
  address_number: null,
  address_street: null,
  city: null,
  country: null,
  cpf: null,
  customer_data_extracted: null,
  external_contact_id: null,
  external_identification_contact: null,
  last_negotiation: null,
  phone_secondary: null,
  rg: null,
  tag: null,
  zip_code: null,
};

export const mockContact2: Contact = {
  id: 'contact-2',
  tenant_id: 'tenant-1',
  name: 'Maria Santos',
  phone: '5511988888888',
  email: 'maria@example.com',
  status: 'with_ai',
  created_at: '2025-11-22T08:00:00Z',
  updated_at: '2025-11-22T08:00:00Z',
  last_interaction_at: '2025-11-22T08:00:00Z',
  // Campos opcionais
  address_complement: null,
  address_number: null,
  address_street: null,
  city: null,
  country: null,
  cpf: null,
  customer_data_extracted: null,
  external_contact_id: null,
  external_identification_contact: null,
  last_negotiation: null,
  phone_secondary: null,
  rg: null,
  tag: null,
  zip_code: null,
};

// ===== MENSAGENS =====

export const mockMessage: Message = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  content: 'Olá, tudo bem?',
  timestamp: '2025-11-23T10:00:00Z',
  created_at: '2025-11-23T10:00:00Z',
  updated_at: '2025-11-23T10:00:00Z',
  sender_type: 'customer',
  sender_user_id: null,
  sender_agent_id: null,
  external_message_id: 'ext-msg-1',
  feedback_type: null,
  feedback_text: null,
  status: null,
};

export const mockMessage2: Message = {
  id: 'msg-2',
  conversation_id: 'conv-1',
  content: 'Sim, como posso ajudar?',
  timestamp: '2025-11-23T10:01:00Z',
  created_at: '2025-11-23T10:01:00Z',
  updated_at: '2025-11-23T10:01:00Z',
  sender_type: 'ai',
  sender_user_id: null,
  sender_agent_id: null,
  external_message_id: 'ext-msg-2',
  feedback_type: null,
  feedback_text: null,
  status: null,
};

export const mockMessage3: Message = {
  id: 'msg-3',
  conversation_id: 'conv-2',
  content: 'Olá!',
  timestamp: '2025-11-23T11:00:00Z',
  created_at: '2025-11-23T11:00:00Z',
  updated_at: '2025-11-23T11:00:00Z',
  sender_type: 'customer',
  sender_user_id: null,
  sender_agent_id: null,
  external_message_id: 'ext-msg-3',
  feedback_type: null,
  feedback_text: null,
  status: null,
};

// ===== CONVERSAS =====

export const mockConversation: ConversationWithContact = {
  id: 'conv-1',
  tenant_id: 'tenant-1',
  contact_id: 'contact-1',
  channel_id: 'channel-1',
  status: 'open',
  ia_active: true,
  last_message_at: '2025-11-23T10:01:00Z',
  created_at: '2025-11-23T09:00:00Z',
  updated_at: '2025-11-23T10:01:00Z',
  pause_notes: null,
  conversation_pause_reason_id: null,
  closure_notes: null,
  conversation_closure_reason_id: null,
  external_id: null,
  overall_feedback_text: null,
  overall_feedback_type: null,
  consecutive_reactivations: 0,
  total_reactivations: 0,
  has_unread: false,
  unread_count: 0,
  is_important: false,
  contact: mockContact,
  lastMessage: mockMessage2,
};

export const mockConversation2: ConversationWithContact = {
  id: 'conv-2',
  tenant_id: 'tenant-1',
  contact_id: 'contact-2',
  channel_id: 'channel-1',
  status: 'open',
  ia_active: false,
  last_message_at: '2025-11-23T11:00:00Z',
  created_at: '2025-11-22T08:00:00Z',
  updated_at: '2025-11-23T11:00:00Z',
  pause_notes: 'Aguardando resposta do cliente',
  conversation_pause_reason_id: null,
  closure_notes: null,
  conversation_closure_reason_id: null,
  external_id: null,
  overall_feedback_text: null,
  overall_feedback_type: null,
  consecutive_reactivations: 0,
  total_reactivations: 0,
  has_unread: true,
  unread_count: 3,
  is_important: false,
  contact: mockContact2,
  lastMessage: mockMessage3,
};

export const mockConversation3: ConversationWithContact = {
  id: 'conv-3',
  tenant_id: 'tenant-1',
  contact_id: 'contact-1',
  channel_id: 'channel-1',
  status: 'closed',
  ia_active: false,
  last_message_at: '2025-11-20T15:00:00Z',
  created_at: '2025-11-20T10:00:00Z',
  updated_at: '2025-11-20T15:00:00Z',
  pause_notes: null,
  conversation_pause_reason_id: null,
  closure_notes: 'Conversa encerrada pelo cliente',
  conversation_closure_reason_id: null,
  external_id: null,
  overall_feedback_text: null,
  overall_feedback_type: null,
  consecutive_reactivations: 0,
  total_reactivations: 0,
  has_unread: false,
  unread_count: 0,
  is_important: false,
  contact: mockContact,
  lastMessage: null,
};

export const mockConversations: ConversationWithContact[] = [
  mockConversation,
  mockConversation2,
  mockConversation3,
];

// ===== HELPERS =====

/**
 * Cria uma conversa mockada customizada
 */
export const createMockConversation = (
  overrides: Partial<ConversationWithContact> = {}
): ConversationWithContact => ({
  ...mockConversation,
  ...overrides,
});

/**
 * Cria um contato mockado customizado
 */
export const createMockContact = (
  overrides: Partial<Contact> = {}
): Contact => ({
  ...mockContact,
  ...overrides,
});

/**
 * Cria uma mensagem mockada customizada
 */
export const createMockMessage = (
  overrides: Partial<Message> = {}
): Message => ({
  ...mockMessage,
  ...overrides,
});

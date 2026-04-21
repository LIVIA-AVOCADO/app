import { createClient } from '@/lib/supabase/client';
import { getConversationsWithContact } from '@/lib/queries/inbox';
import type { IConversationRepository } from './interfaces/IConversationRepository';
import type { ConversationWithContact, ConversationFilters } from '@/types/livechat';
import type { Contact } from '@/types/database-helpers';

/**
 * Implementação concreta do Repository de Conversas
 *
 * Responsabilidades (SRP - Single Responsibility):
 * - Buscar conversas do banco de dados
 * - Cachear contatos para otimizar queries realtime
 * - Validar tenant_id em todas as operações
 *
 * Dependency Inversion (DIP):
 * - Implementa IConversationRepository
 * - Pode ser substituído por outra implementação (ex: API REST)
 */
export class ConversationRepository implements IConversationRepository {
  private supabase;

  /**
   * Cache local de contatos para evitar queries repetidas
   * durante eventos realtime
   */
  private contactsCache = new Map<string, Contact>();

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Busca conversa por ID com validação de tenant
   */
  async getById(
    conversationId: string,
    tenantId: string
  ): Promise<ConversationWithContact | null> {
    const { data, error } = await this.supabase
      .from('conversations')
      .select(`
        *,
        contacts!inner(
          id,
          name,
          phone,
          email,
          status,
          created_at,
          updated_at,
          last_interaction_at,
          address_complement,
          address_number,
          address_street,
          city,
          country,
          cpf,
          customer_data_extracted,
          external_contact_id,
          external_identification_contact,
          last_negotiation,
          phone_secondary,
          rg,
          tags,
          tenant_id,
          zip_code
        )
      `)
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    // Buscar última mensagem
    const { data: lastMessageData } = await this.supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    // Converter estrutura (contacts -> contact)
    const conversation = data as unknown as { contacts: unknown; [key: string]: unknown };
    const { contacts, ...conversationData } = conversation;

    return {
      ...conversationData,
      contact: contacts,
      lastMessage: lastMessageData || null,
    } as ConversationWithContact;
  }

  /**
   * Busca todas conversas de um tenant
   *
   * Delega para a query existente (já otimizada)
   */
  async getByTenant(
    tenantId: string,
    filters?: ConversationFilters
  ): Promise<ConversationWithContact[]> {
    const conversations = await getConversationsWithContact(tenantId, filters);
    return conversations;
  }

  /**
   * Busca contato por ID (com cache)
   *
   * Cache evita queries repetidas durante eventos realtime
   * que atualizam múltiplas conversas do mesmo contato.
   */
  async getContactById(
    contactId: string,
    tenantId: string
  ): Promise<Contact | null> {
    // Verificar cache primeiro
    if (this.contactsCache.has(contactId)) {
      return this.contactsCache.get(contactId)!;
    }

    // Buscar no banco
    const { data, error } = await this.supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      return null;
    }

    if (!data) {
      return null;
    }

    // Adicionar ao cache
    this.contactsCache.set(contactId, data);
    return data;
  }

  /**
   * Limpa cache de contatos
   *
   * Deve ser chamado quando necessário invalidar o cache
   * (ex: após atualização de dados de contato).
   */
  clearCache(): void {
    this.contactsCache.clear();
  }
}

/**
 * Singleton instance do repository
 *
 * Exporta instância única para reutilização em toda aplicação.
 * Mantém cache consistente entre diferentes partes do código.
 */
export const conversationRepository = new ConversationRepository();

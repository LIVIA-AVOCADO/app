import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockConversation, mockConversations, mockContact } from '@/lib/__tests__/fixtures/conversations';

// Mock da query existente
vi.mock('@/lib/queries/inbox', () => ({
  getConversationsWithContact: vi.fn(),
}));

// Mock do createClient (será substituído no beforeEach)
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

import { ConversationRepository } from '../ConversationRepository';
import { createClient } from '@/lib/supabase/client';

describe('ConversationRepository', () => {
  let repository: ConversationRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSupabase: any;

  beforeEach(() => {
    // Criar mock do Supabase
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    // Configurar createClient para retornar o mock
    vi.mocked(createClient).mockReturnValue(mockSupabase);

    repository = new ConversationRepository();
    repository.clearCache();
  });

  describe('getById', () => {
    it('deve retornar conversa com contato e última mensagem', async () => {
      // Arrange
      const conversationWithContacts = {
        ...mockConversation,
        contacts: mockConversation.contact,
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: conversationWithContacts,
          error: null,
        })
        .mockResolvedValueOnce({
          data: mockConversation.lastMessage,
          error: null,
        });

      // Act
      const result = await repository.getById('conv-1', 'tenant-1');

      // Assert
      expect(result).toEqual(mockConversation);
      expect(mockSupabase.from).toHaveBeenCalledWith('conversations');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'conv-1');
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    });

    it('deve retornar null se conversa não existir', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      // Act
      const result = await repository.getById('invalid-id', 'tenant-1');

      // Assert
      expect(result).toBeNull();
    });

    it('deve retornar null se tenant_id não bater', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      // Act
      const result = await repository.getById('conv-1', 'wrong-tenant');

      // Assert
      expect(result).toBeNull();
    });

    it('deve retornar conversa sem lastMessage se não houver mensagens', async () => {
      // Arrange
      const conversationWithContacts = {
        ...mockConversation,
        contacts: mockConversation.contact,
      };

      mockSupabase.single
        .mockResolvedValueOnce({
          data: conversationWithContacts,
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        });

      // Act
      const result = await repository.getById('conv-1', 'tenant-1');

      // Assert
      expect(result).toBeDefined();
      expect(result?.lastMessage).toBeNull();
    });
  });

  describe('getByTenant', () => {
    it('deve retornar conversas do tenant', async () => {
      // Arrange
      const { getConversationsWithContact } = await import('@/lib/queries/inbox');
      vi.mocked(getConversationsWithContact).mockResolvedValue(mockConversations);

      // Act
      const result = await repository.getByTenant('tenant-1');

      // Assert
      expect(result).toEqual(mockConversations);
      expect(getConversationsWithContact).toHaveBeenCalledWith('tenant-1', undefined);
    });

    it('deve passar filtros para a query', async () => {
      // Arrange
      const { getConversationsWithContact } = await import('@/lib/queries/inbox');
      vi.mocked(getConversationsWithContact).mockResolvedValue(mockConversations);

      const filters = {
        includeClosedConversations: true,
        search: 'João',
      };

      // Act
      await repository.getByTenant('tenant-1', filters);

      // Assert
      expect(getConversationsWithContact).toHaveBeenCalledWith('tenant-1', filters);
    });

    it('deve retornar array vazio se não houver conversas', async () => {
      // Arrange
      const { getConversationsWithContact } = await import('@/lib/queries/inbox');
      vi.mocked(getConversationsWithContact).mockResolvedValue([]);

      // Act
      const result = await repository.getByTenant('tenant-1');

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getContactById (cache)', () => {
    it('deve retornar contato do cache se existir', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: mockContact,
        error: null,
      });

      // Act - primeira chamada (popula cache)
      const firstCall = await repository.getContactById('contact-1', 'tenant-1');

      // Act - segunda chamada (deve usar cache)
      const secondCall = await repository.getContactById('contact-1', 'tenant-1');

      // Assert
      expect(firstCall).toEqual(mockContact);
      expect(secondCall).toEqual(mockContact);
      expect(mockSupabase.from).toHaveBeenCalledTimes(1); // Apenas 1 query (primeira)
    });

    it('deve fazer query se não estiver no cache', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: mockContact,
        error: null,
      });

      // Act
      const result = await repository.getContactById('contact-1', 'tenant-1');

      // Assert
      expect(result).toEqual(mockContact);
      expect(mockSupabase.from).toHaveBeenCalledWith('contacts');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'contact-1');
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', 'tenant-1');
    });

    it('deve retornar null se contato não existir', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      // Act
      const result = await repository.getContactById('invalid-id', 'tenant-1');

      // Assert
      expect(result).toBeNull();
    });

    it('clearCache deve limpar o cache', async () => {
      // Arrange
      mockSupabase.single.mockResolvedValue({
        data: mockContact,
        error: null,
      });

      // Act
      await repository.getContactById('contact-1', 'tenant-1');
      repository.clearCache();
      await repository.getContactById('contact-1', 'tenant-1');

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledTimes(2); // Cache foi limpo, fez 2 queries
    });

    it('deve cachear contatos diferentes separadamente', async () => {
      // Arrange
      const contact1 = mockContact;
      const contact2 = { ...mockContact, id: 'contact-2', name: 'Maria' };

      mockSupabase.single
        .mockResolvedValueOnce({ data: contact1, error: null })
        .mockResolvedValueOnce({ data: contact2, error: null });

      // Act
      const result1 = await repository.getContactById('contact-1', 'tenant-1');
      const result2 = await repository.getContactById('contact-2', 'tenant-1');
      const result1Again = await repository.getContactById('contact-1', 'tenant-1');

      // Assert
      expect(result1).toEqual(contact1);
      expect(result2).toEqual(contact2);
      expect(result1Again).toEqual(contact1);
      expect(mockSupabase.from).toHaveBeenCalledTimes(2); // 2 queries (não 3)
    });
  });
});

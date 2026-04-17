import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryBuilder, createServerSupabaseMock } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import {
  getQuickReplies,
  getQuickReplyById,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
  incrementQuickReplyUsage,
  getPopularQuickReplies,
} from '../quick-replies';

const mockCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

// Representa um registro como vem do banco (icon/message)
const dbRow = {
  id: 'qr-1',
  tenant_id: 'tenant-1',
  icon: '👋',
  title: 'Saudação',
  message: 'Olá, como posso ajudar?',
  active: true,
  usage_count: 5,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// Representa o objeto esperado no código (emoji/content)
const expectedQuickReply = {
  id: 'qr-1',
  tenant_id: 'tenant-1',
  emoji: '👋',
  title: 'Saudação',
  content: 'Olá, como posso ajudar?',
  active: true,
  usage_count: 5,
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

// ===== MAPPING (icon→emoji, message→content) =====

describe('getQuickReplyById — mapeamento de campos', () => {
  it('mapeia icon → emoji e message → content', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: dbRow, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getQuickReplyById('qr-1', 'tenant-1');
    expect(result?.emoji).toBe('👋');
    expect(result?.content).toBe('Olá, como posso ajudar?');
  });

  it('NÃO expõe campos icon/message do banco diretamente', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: dbRow, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getQuickReplyById('qr-1', 'tenant-1') as any;
    expect(result?.icon).toBeUndefined();
    expect(result?.message).toBeUndefined();
  });

  it('retorna null em caso de erro (não lança exceção)', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Not found' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getQuickReplyById('qr-inexistente', 'tenant-1');
    expect(result).toBeNull();
  });

  it('valida tenant_id na query', async () => {
    const mock = createServerSupabaseMock();
    const qb = createQueryBuilder({ data: dbRow, error: null });
    mock.from.mockReturnValue(qb);
    mockCreateClient.mockResolvedValue(mock as any);

    await getQuickReplyById('qr-1', 'tenant-xyz');
    expect(qb.eq).toHaveBeenCalledWith('tenant_id', 'tenant-xyz');
  });
});

// ===== GET QUICK REPLIES =====

describe('getQuickReplies', () => {
  it('retorna quick replies com estrutura de paginação', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [dbRow], error: null, count: 1 }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getQuickReplies('tenant-1');
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.hasMore).toBe(false);
  });

  it('mapeia campos corretamente na lista', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [dbRow], error: null, count: 1 }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getQuickReplies('tenant-1');
    expect(result.data[0]).toMatchObject(expectedQuickReply);
  });

  it('calcula hasMore = true quando há mais itens', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [dbRow], error: null, count: 100 }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getQuickReplies('tenant-1', { limit: 10, offset: 0 });
    expect(result.hasMore).toBe(true); // 0 + 10 < 100
  });

  it('calcula hasMore = false quando está na última página', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [dbRow], error: null, count: 10 }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getQuickReplies('tenant-1', { limit: 10, offset: 0 });
    expect(result.hasMore).toBe(false); // 0 + 10 = 10 (não < 10)
  });

  it('lança erro em caso de falha no banco', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'DB Error' }, count: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(getQuickReplies('tenant-1')).rejects.toMatchObject({ message: 'DB Error' });
  });
});

// ===== CREATE QUICK REPLY =====

describe('createQuickReply', () => {
  it('cria quick reply e retorna com campos mapeados', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: dbRow, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await createQuickReply(
      { tenantId: 'tenant-1', title: 'Saudação', content: 'Olá!', emoji: '👋' },
      'user-1'
    );

    expect(result.emoji).toBe('👋');
    expect(result.content).toBe('Olá, como posso ajudar?'); // vem do dbRow
  });

  it('lança erro se o insert falhar', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Insert Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(
      createQuickReply({ tenantId: 'tenant-1', title: 'Test', content: 'Test' }, 'user-1')
    ).rejects.toMatchObject({ message: 'Insert Error' });
  });
});

// ===== UPDATE QUICK REPLY =====

describe('updateQuickReply', () => {
  it('atualiza e retorna quick reply com campos mapeados', async () => {
    const updatedRow = { ...dbRow, message: 'Mensagem atualizada' };
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: updatedRow, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await updateQuickReply('qr-1', 'tenant-1', { content: 'Mensagem atualizada' });
    expect(result.content).toBe('Mensagem atualizada');
  });

  it('lança erro se update falhar', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Update Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(
      updateQuickReply('qr-1', 'tenant-1', { title: 'Novo título' })
    ).rejects.toMatchObject({ message: 'Update Error' });
  });
});

// ===== DELETE QUICK REPLY =====

describe('deleteQuickReply', () => {
  it('retorna true quando deletado com sucesso', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await deleteQuickReply('qr-1', 'tenant-1');
    expect(result).toBe(true);
  });

  it('lança erro se delete falhar', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Delete Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(deleteQuickReply('qr-1', 'tenant-1')).rejects.toMatchObject({ message: 'Delete Error' });
  });

  it('filtra por tenant_id na deleção', async () => {
    const mock = createServerSupabaseMock();
    const qb = createQueryBuilder({ data: null, error: null });
    mock.from.mockReturnValue(qb);
    mockCreateClient.mockResolvedValue(mock as any);

    await deleteQuickReply('qr-1', 'tenant-xyz');
    expect(qb.eq).toHaveBeenCalledWith('tenant_id', 'tenant-xyz');
  });
});

// ===== INCREMENT USAGE =====

describe('incrementQuickReplyUsage', () => {
  it('lança erro se quick reply não existir', async () => {
    // Primeiro from() = getQuickReplyById (retorna null = error)
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Not found' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(incrementQuickReplyUsage('qr-inexistente', 'tenant-1')).rejects.toThrow(
      'Quick reply not found'
    );
  });

  it('incrementa o contador de uso', async () => {
    const mock = createServerSupabaseMock();
    // Primeira chamada: getQuickReplyById retorna a quick reply
    // Segunda chamada: update retorna sucesso
    mock.from
      .mockReturnValueOnce(createQueryBuilder({ data: dbRow, error: null }))
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    // Não deve lançar erro
    await expect(incrementQuickReplyUsage('qr-1', 'tenant-1')).resolves.not.toThrow();
  });
});

// ===== POPULAR QUICK REPLIES =====

describe('getPopularQuickReplies', () => {
  it('retorna quick replies populares mapeadas', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [dbRow], error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getPopularQuickReplies('tenant-1', 5);
    expect(result[0].emoji).toBe('👋');
    expect(result[0].content).toBe('Olá, como posso ajudar?');
  });

  it('lança erro se query falhar', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(getPopularQuickReplies('tenant-1')).rejects.toMatchObject({ message: 'Error' });
  });
});

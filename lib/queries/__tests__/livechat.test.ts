import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryBuilder, createServerSupabaseMock } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import {
  searchMessagesByContent,
  getConversation,
  getMessages,
  getQuickReplies,
  getContact,
  getLivechatTabStatusCounts,
} from '../livechat';

const mockCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

// ===== searchMessagesByContent =====

describe('searchMessagesByContent', () => {
  it('retorna array vazio para query com menos de 3 caracteres', async () => {
    const result = await searchMessagesByContent('tenant-1', 'ab');
    expect(result).toEqual([]);
  });

  it('retorna array vazio para query vazia', async () => {
    const result = await searchMessagesByContent('tenant-1', '');
    expect(result).toEqual([]);
  });

  it('retorna array vazio para query com apenas espaços', async () => {
    const result = await searchMessagesByContent('tenant-1', '   ');
    expect(result).toEqual([]);
  });

  it('chama RPC para query válida (≥ 3 caracteres)', async () => {
    const mock = createServerSupabaseMock();
    mock.rpc.mockResolvedValue({ data: [{ id: 'msg-1', content: 'resultado' }], error: null });
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await searchMessagesByContent('tenant-1', 'ola');
    expect(result).toHaveLength(1);
    expect(mock.rpc).toHaveBeenCalledWith('search_messages_by_content', expect.objectContaining({
      p_tenant_id: 'tenant-1',
      p_query: 'ola',
    }));
  });

  it('lança erro quando RPC falha', async () => {
    const mock = createServerSupabaseMock();
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'RPC Error' } });
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(searchMessagesByContent('tenant-1', 'busca')).rejects.toMatchObject({
      message: 'RPC Error',
    });
  });

  it('usa o trim da query antes de enviar para RPC', async () => {
    const mock = createServerSupabaseMock();
    mock.rpc.mockResolvedValue({ data: [], error: null });
    mockCreateClient.mockResolvedValue(mock as any);

    await searchMessagesByContent('tenant-1', '  busca  ');
    expect(mock.rpc).toHaveBeenCalledWith('search_messages_by_content', expect.objectContaining({
      p_query: 'busca', // trim aplicado
    }));
  });

  it('passa limit e offset corretos para RPC', async () => {
    const mock = createServerSupabaseMock();
    mock.rpc.mockResolvedValue({ data: [], error: null });
    mockCreateClient.mockResolvedValue(mock as any);

    await searchMessagesByContent('tenant-1', 'busca', 10, 20);
    expect(mock.rpc).toHaveBeenCalledWith('search_messages_by_content', expect.objectContaining({
      p_limit: 10,
      p_offset: 20,
    }));
  });
});

// ===== getConversation =====

describe('getConversation', () => {
  const mockConversationData = {
    id: 'conv-1',
    tenant_id: 'tenant-1',
    status: 'open',
    ia_active: true,
    conversation_tags: [],
  };

  it('retorna conversa quando encontrada', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: mockConversationData, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getConversation('conv-1', 'tenant-1');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('conv-1');
  });

  it('retorna null para conversa não encontrada (PGRST116)', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getConversation('conv-inexistente', 'tenant-1');
    expect(result).toBeNull();
  });

  it('lança erro para erros que não são PGRST116', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'DB_ERROR', message: 'Falha' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(getConversation('conv-1', 'tenant-1')).rejects.toMatchObject({ code: 'DB_ERROR' });
  });

  it('retorna null quando data é null sem erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getConversation('conv-1', 'tenant-1');
    expect(result).toBeNull();
  });

  it('inclui lastMessage como null', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: mockConversationData, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getConversation('conv-1', 'tenant-1');
    expect(result?.lastMessage).toBeNull();
  });

  it('valida tenant_id na query', async () => {
    const mock = createServerSupabaseMock();
    const qb = createQueryBuilder({ data: mockConversationData, error: null });
    mock.from.mockReturnValue(qb);
    mockCreateClient.mockResolvedValue(mock as any);

    await getConversation('conv-1', 'tenant-xyz');
    expect(qb.eq).toHaveBeenCalledWith('tenant_id', 'tenant-xyz');
  });
});

// ===== getMessages =====

describe('getMessages', () => {
  const dbMessage = {
    id: 'msg-1',
    conversation_id: 'conv-1',
    content: 'Olá!',
    timestamp: '2026-01-01T10:00:00Z',
    sender_type: 'customer',
    sender_user_id: null,
    message_attachments: [],
    quotedMessage: null,
    senderUser: null,
  };

  it('retorna mensagens em ordem crescente de timestamp', async () => {
    // O banco retorna DESC (mais recente primeiro), a função aplica reverse() para ficar ASC
    const msgsDescFromDb = [
      { ...dbMessage, id: 'msg-2', timestamp: '2026-01-01T11:00:00Z', message_attachments: [], quotedMessage: null },
      { ...dbMessage, id: 'msg-1', timestamp: '2026-01-01T10:00:00Z', message_attachments: [], quotedMessage: null },
    ];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: msgsDescFromDb, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getMessages('conv-1');
    // Após reverse(): msg-1 (mais antigo) primeiro
    expect(result[0].id).toBe('msg-1');
    expect(result[1].id).toBe('msg-2');
  });

  it('mapeia attachment da lista message_attachments', async () => {
    const attachment = { id: 'att-1', attachment_type: 'image', file_name: 'foto.jpg' };
    const msgWithAttachment = { ...dbMessage, message_attachments: [attachment] };
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [msgWithAttachment], error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getMessages('conv-1');
    expect(result[0].attachment).toEqual(attachment);
    expect((result[0] as any).message_attachments).toBeUndefined();
  });

  it('retorna attachment null quando não há anexos', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [dbMessage], error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getMessages('conv-1');
    expect(result[0].attachment).toBeNull();
  });

  it('lança erro quando query falha', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Query Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(getMessages('conv-1')).rejects.toMatchObject({ message: 'Query Error' });
  });

  it('retorna array vazio quando não há mensagens', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [], error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getMessages('conv-1');
    expect(result).toEqual([]);
  });
});

// ===== getQuickReplies (livechat) =====

describe('getQuickReplies (livechat)', () => {
  it('retorna quick replies do tenant', async () => {
    const qrs = [{ id: 'qr-1', tenant_id: 'tenant-1', message: 'Olá!' }];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: qrs, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getQuickReplies('tenant-1');
    expect(result).toEqual(qrs);
  });

  it('lança erro quando query falha', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(getQuickReplies('tenant-1')).rejects.toMatchObject({ message: 'Error' });
  });
});

// ===== getContact (livechat) =====

describe('getContact (livechat)', () => {
  it('retorna contato quando encontrado', async () => {
    const contact = { id: 'c-1', name: 'João', tenant_id: 'tenant-1' };
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: contact, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getContact('c-1', 'tenant-1');
    expect(result).toEqual(contact);
  });

  it('lança erro quando não encontrado', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    await expect(getContact('c-inexistente', 'tenant-1')).rejects.toMatchObject({ code: 'PGRST116' });
  });
});

// ===== getLivechatTabStatusCounts =====

describe('getLivechatTabStatusCounts', () => {
  it('retorna contagens quando RPC funciona', async () => {
    const rpcData = [{
      ia_count: 10,
      manual_count: 5,
      closed_count: 20,
      important_count: 3,
      unread_manual_count: 2,
    }];
    const mock = createServerSupabaseMock();
    mock.rpc.mockResolvedValue({ data: rpcData, error: null });
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getLivechatTabStatusCounts('tenant-1');
    expect(result).toEqual({ ia: 10, manual: 5, closed: 20, important: 3, unreadManual: 2 });
  });

  it('retorna null quando RPC não está disponível (graceful)', async () => {
    const mock = createServerSupabaseMock();
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'Function not found', code: '42883' } });
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getLivechatTabStatusCounts('tenant-1');
    expect(result).toBeNull();
  });

  it('retorna null quando data é array vazio', async () => {
    const mock = createServerSupabaseMock();
    mock.rpc.mockResolvedValue({ data: [], error: null });
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getLivechatTabStatusCounts('tenant-1');
    expect(result).toBeNull();
  });

  it('converte valores não numéricos para 0', async () => {
    const rpcData = [{ ia_count: '5', manual_count: null, closed_count: 0, important_count: undefined, unread_manual_count: '2' }];
    const mock = createServerSupabaseMock();
    mock.rpc.mockResolvedValue({ data: rpcData, error: null });
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getLivechatTabStatusCounts('tenant-1');
    expect(result?.ia).toBe(5);
    expect(result?.manual).toBe(0);
    expect(result?.important).toBe(0);
    expect(result?.unreadManual).toBe(2);
  });
});

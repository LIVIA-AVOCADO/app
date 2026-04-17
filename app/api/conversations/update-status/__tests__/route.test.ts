import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createQueryBuilder } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { POST } from '../route';

const mockCreateClient = vi.mocked(createClient);

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const CONV_ID = 'conv-1';

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/conversations/update-status', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockSupabase(overrides: {
  user?: object | null;
  tenantId?: string | null;
  conversation?: object | null;
  updateError?: object | null;
}) {
  const { user = { id: USER_ID }, tenantId = TENANT_ID, conversation = { id: CONV_ID, tenant_id: TENANT_ID, status: 'open' }, updateError = null } = overrides;

  const mock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No user' },
      }),
    },
    from: vi.fn()
      // 1ª chamada: users (tenant validation)
      .mockReturnValueOnce(createQueryBuilder({ data: tenantId ? { tenant_id: tenantId } : null, error: null }))
      // 2ª chamada: conversations (fetch)
      .mockReturnValueOnce(createQueryBuilder({ data: conversation, error: conversation ? null : { code: 'PGRST116' } }))
      // 3ª chamada: conversations (update)
      .mockReturnValueOnce(createQueryBuilder({ data: { ...conversation, status: 'closed' }, error: updateError })),
  };
  mockCreateClient.mockResolvedValue(mock as any);
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/conversations/update-status', () => {
  it('retorna 401 quando não autenticado', async () => {
    mockSupabase({ user: null });
    const res = await POST(buildRequest({ conversationId: CONV_ID, status: 'closed', tenantId: TENANT_ID }));
    expect(res.status).toBe(401);
  });

  it('retorna 400 quando campos obrigatórios ausentes', async () => {
    mockSupabase({});
    const res = await POST(buildRequest({ conversationId: CONV_ID })); // sem status e tenantId
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('obrigatórios');
  });

  it('retorna 400 para status inválido', async () => {
    mockSupabase({});
    const res = await POST(buildRequest({ conversationId: CONV_ID, status: 'pausado', tenantId: TENANT_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Status inválido');
  });

  it('aceita status "open"', async () => {
    mockSupabase({});
    const res = await POST(buildRequest({ conversationId: CONV_ID, status: 'open', tenantId: TENANT_ID }));
    expect(res.status).toBe(200);
  });

  it('aceita status "closed"', async () => {
    mockSupabase({});
    const res = await POST(buildRequest({ conversationId: CONV_ID, status: 'closed', tenantId: TENANT_ID }));
    expect(res.status).toBe(200);
  });

  it('retorna 403 quando tenantId do request não bate com o do usuário', async () => {
    mockSupabase({ tenantId: 'outro-tenant' });
    const res = await POST(buildRequest({ conversationId: CONV_ID, status: 'closed', tenantId: TENANT_ID }));
    expect(res.status).toBe(403);
  });

  it('retorna 404 quando conversa não pertence ao tenant', async () => {
    mockSupabase({ conversation: null });
    const res = await POST(buildRequest({ conversationId: CONV_ID, status: 'closed', tenantId: TENANT_ID }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('não encontrada');
  });

  it('retorna 200 com conversation atualizada', async () => {
    mockSupabase({});
    const res = await POST(buildRequest({ conversationId: CONV_ID, status: 'closed', tenantId: TENANT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.conversation).toBeDefined();
  });

  it('retorna 500 quando update falha', async () => {
    mockSupabase({ updateError: { message: 'DB Error' } });
    const res = await POST(buildRequest({ conversationId: CONV_ID, status: 'closed', tenantId: TENANT_ID }));
    expect(res.status).toBe(500);
  });
});

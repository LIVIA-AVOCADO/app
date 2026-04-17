import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createQueryBuilder } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { POST } from '../route';

const mockCreateClient = vi.mocked(createClient);

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/conversations/mark-as-read', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockSupabase(options: { user?: object | null; updateError?: object | null } = {}) {
  const { user = { id: 'user-1' }, updateError = null } = options;
  const mock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No user' },
      }),
    },
    from: vi.fn().mockReturnValue(
      createQueryBuilder({ data: null, error: updateError })
    ),
  };
  mockCreateClient.mockResolvedValue(mock as any);
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/conversations/mark-as-read', () => {
  it('retorna 400 quando conversationId ausente', async () => {
    mockSupabase();
    const res = await POST(buildRequest({ tenantId: 'tenant-1' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('obrigatórios');
  });

  it('retorna 400 quando tenantId ausente', async () => {
    mockSupabase();
    const res = await POST(buildRequest({ conversationId: 'conv-1' }));
    expect(res.status).toBe(400);
  });

  it('retorna 401 quando não autenticado', async () => {
    mockSupabase({ user: null });
    const res = await POST(buildRequest({ conversationId: 'conv-1', tenantId: 'tenant-1' }));
    expect(res.status).toBe(401);
  });

  it('retorna 200 quando marcada como lida com sucesso', async () => {
    mockSupabase();
    const res = await POST(buildRequest({ conversationId: 'conv-1', tenantId: 'tenant-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('lida');
  });

  it('retorna 500 quando update falha', async () => {
    mockSupabase({ updateError: { message: 'DB Error' } });
    const res = await POST(buildRequest({ conversationId: 'conv-1', tenantId: 'tenant-1' }));
    expect(res.status).toBe(500);
  });

  it('atualiza com has_unread=false e unread_count=0', async () => {
    const mock = mockSupabase();
    await POST(buildRequest({ conversationId: 'conv-1', tenantId: 'tenant-1' }));
    const qb = mock.from.mock.results[0].value;
    expect(qb.update).toHaveBeenCalledWith(
      expect.objectContaining({ has_unread: false, unread_count: 0 })
    );
  });

  it('filtra por conversationId e tenantId no update', async () => {
    const mock = mockSupabase();
    await POST(buildRequest({ conversationId: 'conv-abc', tenantId: 'tenant-xyz' }));
    const qb = mock.from.mock.results[0].value;
    expect(qb.eq).toHaveBeenCalledWith('id', 'conv-abc');
    expect(qb.eq).toHaveBeenCalledWith('tenant_id', 'tenant-xyz');
  });
});

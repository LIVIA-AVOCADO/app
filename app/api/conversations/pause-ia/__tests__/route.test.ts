import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createQueryBuilder } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/n8n/client', () => ({ callN8nWebhook: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import { callN8nWebhook } from '@/lib/n8n/client';
import { POST } from '../route';

const mockCreateClient = vi.mocked(createClient);
const mockCallN8n = vi.mocked(callN8nWebhook);

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';
const CONV_ID = 'conv-1';

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/conversations/pause-ia', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockSupabase(options: {
  user?: object | null;
  conversation?: object | null;
  updateError?: object | null;
}) {
  const {
    user = { id: USER_ID },
    conversation = { id: CONV_ID, tenant_id: TENANT_ID, ia_active: true, status: 'open' },
    updateError = null,
  } = options;

  const mock = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'No user' },
      }),
    },
    from: vi.fn()
      // 1ª chamada: conversations (fetch + validação)
      .mockReturnValueOnce(createQueryBuilder({ data: conversation, error: conversation ? null : { code: 'PGRST116' } }))
      // 2ª chamada (fallback): conversations (update direto)
      .mockReturnValueOnce(createQueryBuilder({ data: null, error: updateError })),
  };
  mockCreateClient.mockResolvedValue(mock as any);
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.N8N_PAUSE_IA_WEBHOOK = '/webhook/pause-ia';
});

describe('POST /api/conversations/pause-ia', () => {
  it('retorna 400 quando campos obrigatórios ausentes', async () => {
    mockSupabase({});
    const res = await POST(buildRequest({ conversationId: CONV_ID })); // sem tenantId
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('obrigatórios');
  });

  it('retorna 401 quando não autenticado', async () => {
    mockSupabase({ user: null });
    const res = await POST(buildRequest({ conversationId: CONV_ID, tenantId: TENANT_ID }));
    expect(res.status).toBe(401);
  });

  it('retorna 404 quando conversa não encontrada', async () => {
    mockSupabase({ conversation: null });
    const res = await POST(buildRequest({ conversationId: CONV_ID, tenantId: TENANT_ID }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('não encontrada');
  });

  it('retorna 400 quando IA já está pausada (ia_active=false)', async () => {
    mockSupabase({ conversation: { id: CONV_ID, tenant_id: TENANT_ID, ia_active: false, status: 'open' } });
    const res = await POST(buildRequest({ conversationId: CONV_ID, tenantId: TENANT_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('IA já está pausada');
  });

  it('retorna 200 quando n8n processa com sucesso', async () => {
    mockSupabase({});
    mockCallN8n.mockResolvedValue({ success: true });

    const res = await POST(buildRequest({ conversationId: CONV_ID, tenantId: TENANT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).not.toContain('fallback');
  });

  it('envia userId e reason corretos para o n8n', async () => {
    mockSupabase({});
    mockCallN8n.mockResolvedValue({ success: true });

    await POST(buildRequest({ conversationId: CONV_ID, tenantId: TENANT_ID, reason: 'Motivo teste' }));

    expect(mockCallN8n).toHaveBeenCalledOnce();
    // Verifica o payload (2º argumento) — 1º é o webhook path (env var, pode ser undefined em teste)
    const [, payload] = mockCallN8n.mock.calls[0];
    expect(payload).toMatchObject({
      conversationId: CONV_ID,
      tenantId: TENANT_ID,
      userId: USER_ID,
      reason: 'Motivo teste',
    });
  });

  it('usa fallback direto no banco quando n8n falha', async () => {
    mockSupabase({});
    mockCallN8n.mockResolvedValue({ success: false, error: 'n8n timeout' });

    const res = await POST(buildRequest({ conversationId: CONV_ID, tenantId: TENANT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('fallback');
  });

  it('retorna 500 quando fallback também falha', async () => {
    mockSupabase({ updateError: { message: 'DB Error' } });
    mockCallN8n.mockResolvedValue({ success: false, error: 'n8n timeout' });

    const res = await POST(buildRequest({ conversationId: CONV_ID, tenantId: TENANT_ID }));
    expect(res.status).toBe(500);
  });
});

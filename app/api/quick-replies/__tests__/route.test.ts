import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createQueryBuilder } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/queries/quick-replies', () => ({
  getQuickReplies: vi.fn(),
  createQuickReply: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getQuickReplies, createQuickReply } from '@/lib/queries/quick-replies';
import { GET, POST } from '../route';

const mockCreateClient = vi.mocked(createClient);
const mockGetQuickReplies = vi.mocked(getQuickReplies);
const mockCreateQuickReply = vi.mocked(createQuickReply);

const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000'; // UUID válido
const USER_ID = 'user-1';

function mockAuth(tenantId = TENANT_ID) {
  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
    from: vi.fn().mockReturnValue(createQueryBuilder({ data: { tenant_id: tenantId }, error: null })),
  };
  mockCreateClient.mockResolvedValue(mock as any);
  return mock;
}

function mockNoAuth() {
  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
    from: vi.fn(),
  };
  mockCreateClient.mockResolvedValue(mock as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetQuickReplies.mockResolvedValue({ data: [], total: 0, hasMore: false });
  mockCreateQuickReply.mockResolvedValue({ id: 'qr-1', emoji: '👋', title: 'Olá', content: 'Olá!' } as any);
});

// ===== GET =====

describe('GET /api/quick-replies', () => {
  it('retorna 401 quando não autenticado', async () => {
    mockNoAuth();
    const req = new NextRequest(`http://localhost/api/quick-replies?tenantId=${TENANT_ID}`);
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('retorna 400 quando tenantId ausente', async () => {
    mockAuth();
    const req = new NextRequest('http://localhost/api/quick-replies');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('tenantId');
  });

  it('retorna 400 quando limit inválido (< 1)', async () => {
    mockAuth();
    const req = new NextRequest(`http://localhost/api/quick-replies?tenantId=${TENANT_ID}&limit=0`);
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('limit');
  });

  it('retorna 400 quando limit inválido (> 100)', async () => {
    mockAuth();
    const req = new NextRequest(`http://localhost/api/quick-replies?tenantId=${TENANT_ID}&limit=200`);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('retorna 400 quando offset negativo', async () => {
    mockAuth();
    const req = new NextRequest(`http://localhost/api/quick-replies?tenantId=${TENANT_ID}&offset=-1`);
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('retorna 403 quando tenant do usuário não bate com tenantId da query', async () => {
    mockAuth('tenant-outro');
    const req = new NextRequest(`http://localhost/api/quick-replies?tenantId=${TENANT_ID}`);
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('retorna 200 com lista de quick replies', async () => {
    mockAuth();
    const mockData = { data: [{ id: 'qr-1', title: 'Olá', emoji: '👋', content: 'Olá!' }], total: 1, hasMore: false };
    mockGetQuickReplies.mockResolvedValue(mockData as any);

    const req = new NextRequest(`http://localhost/api/quick-replies?tenantId=${TENANT_ID}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('passa search e limit para getQuickReplies', async () => {
    mockAuth();
    const req = new NextRequest(`http://localhost/api/quick-replies?tenantId=${TENANT_ID}&search=ola&limit=10`);
    await GET(req);
    expect(mockGetQuickReplies).toHaveBeenCalledWith(
      TENANT_ID,
      expect.objectContaining({ search: 'ola', limit: 10 })
    );
  });
});

// ===== POST =====

describe('POST /api/quick-replies', () => {
  function buildPostRequest(body: unknown) {
    return new NextRequest('http://localhost/api/quick-replies', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  it('retorna 401 quando não autenticado', async () => {
    mockNoAuth();
    const res = await POST(buildPostRequest({ title: 'Olá', content: 'Olá!', tenantId: TENANT_ID }));
    expect(res.status).toBe(401);
  });

  it('retorna 400 quando title ausente', async () => {
    mockAuth();
    const res = await POST(buildPostRequest({ content: 'Olá!', tenantId: TENANT_ID }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Dados inválidos');
    expect(body.details).toBeDefined();
  });

  it('retorna 400 quando content ausente', async () => {
    mockAuth();
    const res = await POST(buildPostRequest({ title: 'Olá', tenantId: TENANT_ID }));
    expect(res.status).toBe(400);
  });

  it('retorna 400 quando tenantId não é UUID', async () => {
    mockAuth();
    const res = await POST(buildPostRequest({ title: 'Olá', content: 'Olá!', tenantId: 'nao-uuid' }));
    expect(res.status).toBe(400);
  });

  it('retorna 403 quando tenant do usuário não bate com tenantId do body', async () => {
    mockAuth('outro-tenant');
    const res = await POST(buildPostRequest({ title: 'Olá', content: 'Olá!', tenantId: TENANT_ID }));
    expect(res.status).toBe(403);
  });

  it('retorna 200 com quick reply criada', async () => {
    mockAuth();
    const res = await POST(buildPostRequest({ title: 'Saudação', content: 'Olá, como posso ajudar?', tenantId: TENANT_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  it('passa userId correto para createQuickReply', async () => {
    mockAuth();
    await POST(buildPostRequest({ title: 'Test', content: 'Test content', tenantId: TENANT_ID }));
    expect(mockCreateQuickReply).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_ID }),
      USER_ID
    );
  });

  it('retorna 500 em erro inesperado', async () => {
    mockAuth();
    mockCreateQuickReply.mockRejectedValue(new Error('DB Error'));
    const res = await POST(buildPostRequest({ title: 'Test', content: 'Test', tenantId: TENANT_ID }));
    expect(res.status).toBe(500);
  });
});

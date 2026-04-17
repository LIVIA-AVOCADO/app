import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createQueryBuilder } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/queries/billing', () => ({
  getWallet: vi.fn(),
  getUsageSummaryByProvider: vi.fn(),
  getUsageTotals: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { getWallet, getUsageSummaryByProvider, getUsageTotals } from '@/lib/queries/billing';
import { GET } from '../route';

const mockCreateClient = vi.mocked(createClient);
const mockGetWallet = vi.mocked(getWallet);
const mockGetUsageSummary = vi.mocked(getUsageSummaryByProvider);
const mockGetUsageTotals = vi.mocked(getUsageTotals);

const USER_ID = 'user-1';
const TENANT_ID = 'tenant-1';

function buildRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/billing/wallet');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

function mockAuthSuccess(tenantId = TENANT_ID) {
  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
    from: vi.fn().mockReturnValue(createQueryBuilder({ data: { tenant_id: tenantId }, error: null })),
  };
  mockCreateClient.mockResolvedValue(mock as any);
  return mock;
}

function mockAuthFail() {
  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'No user' } }) },
    from: vi.fn(),
  };
  mockCreateClient.mockResolvedValue(mock as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetWallet.mockResolvedValue(null);
  mockGetUsageSummary.mockResolvedValue([]);
  mockGetUsageTotals.mockResolvedValue({ total_credits: 0, total_brl: 0, calls: 0 });
});

describe('GET /api/billing/wallet', () => {
  it('retorna 401 quando não autenticado', async () => {
    mockAuthFail();
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('retorna 404 quando usuário não tem tenant', async () => {
    const mock = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } })),
    };
    mockCreateClient.mockResolvedValue(mock as any);

    const res = await GET(buildRequest());
    expect(res.status).toBe(404);
  });

  it('retorna 403 quando tenantId do query param não bate com o do usuário', async () => {
    mockAuthSuccess('tenant-1');
    const res = await GET(buildRequest({ tenantId: 'tenant-outro' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Forbidden');
  });

  it('retorna 200 com wallet, usageSummary e usageTotals', async () => {
    mockAuthSuccess();
    const wallet = { balance_credits: 1000, balance_brl: 10, status: 'ok' };
    const summary = [{ provider: 'openai', sku: 'gpt-4', calls: 5, debited_credits: 200, debited_brl: 2 }];
    const totals = { total_credits: 500, total_brl: 5, calls: 10 };

    mockGetWallet.mockResolvedValue(wallet as any);
    mockGetUsageSummary.mockResolvedValue(summary);
    mockGetUsageTotals.mockResolvedValue(totals);

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wallet).toEqual(wallet);
    expect(body.usageSummary).toEqual(summary);
    expect(body.usageTotals).toEqual(totals);
    expect(body.error).toBeNull();
  });

  it('retorna 200 com wallet null quando tenant não tem carteira', async () => {
    mockAuthSuccess();
    mockGetWallet.mockResolvedValue(null);

    const res = await GET(buildRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.wallet).toBeNull();
  });

  it('passa o parâmetro days correto para as queries', async () => {
    mockAuthSuccess();
    await GET(buildRequest({ days: '30' }));
    expect(mockGetUsageSummary).toHaveBeenCalledWith(TENANT_ID, 30);
    expect(mockGetUsageTotals).toHaveBeenCalledWith(TENANT_ID, 30);
  });

  it('usa days=7 como padrão quando não fornecido', async () => {
    mockAuthSuccess();
    await GET(buildRequest());
    expect(mockGetUsageSummary).toHaveBeenCalledWith(TENANT_ID, 7);
  });

  it('retorna 500 em erro inesperado', async () => {
    mockAuthSuccess();
    mockGetWallet.mockRejectedValue(new Error('Unexpected'));

    const res = await GET(buildRequest());
    expect(res.status).toBe(500);
  });

  it('resposta tem Cache-Control header', async () => {
    mockAuthSuccess();
    const res = await GET(buildRequest());
    expect(res.headers.get('Cache-Control')).toContain('private');
  });
});

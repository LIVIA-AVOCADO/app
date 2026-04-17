import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createQueryBuilder } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }));
vi.mock('@/lib/stripe/helpers', () => ({
  createCreditCheckoutSession: vi.fn(),
  createSubscriptionCheckoutSession: vi.fn(),
}));

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createCreditCheckoutSession, createSubscriptionCheckoutSession } from '@/lib/stripe/helpers';
import { POST } from '../route';

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockCreditSession = vi.mocked(createCreditCheckoutSession);
const mockSubSession = vi.mocked(createSubscriptionCheckoutSession);

const TENANT_ID = 'tenant-1';
const USER_ID = 'user-1';

function buildRequest(body: unknown) {
  return new NextRequest('http://localhost/api/stripe/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockAuthSuccess() {
  const mock = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
    from: vi.fn().mockReturnValue(createQueryBuilder({ data: { tenant_id: TENANT_ID }, error: null })),
  };
  mockCreateClient.mockResolvedValue(mock as any);
  return mock;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreditSession.mockResolvedValue('https://checkout.stripe.com/pay/cs_test_123');
  mockSubSession.mockResolvedValue('https://checkout.stripe.com/pay/cs_sub_456');
});

describe('POST /api/stripe/checkout', () => {
  it('retorna 401 quando não autenticado', async () => {
    const mock = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    };
    mockCreateClient.mockResolvedValue(mock as any);

    const res = await POST(buildRequest({ mode: 'subscription', priceId: 'price_abc' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('unauthorized');
  });

  it('retorna 404 quando tenant não encontrado', async () => {
    const mock = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: USER_ID } }, error: null }) },
      from: vi.fn().mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } })),
    };
    mockCreateClient.mockResolvedValue(mock as any);

    const res = await POST(buildRequest({ mode: 'subscription', priceId: 'price_abc' }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe('tenant_not_found');
  });

  it('retorna 400 para body inválido (Zod)', async () => {
    mockAuthSuccess();
    const res = await POST(buildRequest({ mode: 'subscription' })); // sem priceId
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('validation_error');
    expect(body.details).toBeDefined();
  });

  it('retorna 400 para mode inválido', async () => {
    mockAuthSuccess();
    const res = await POST(buildRequest({ mode: 'invalid_mode' }));
    expect(res.status).toBe(400);
  });

  it('retorna 400 para custom_payment abaixo do mínimo', async () => {
    mockAuthSuccess();
    const res = await POST(buildRequest({ mode: 'custom_payment', customAmountCents: 100 }));
    expect(res.status).toBe(400);
  });

  it('retorna 200 com URL para mode subscription', async () => {
    mockAuthSuccess();
    const res = await POST(buildRequest({ mode: 'subscription', priceId: 'price_pro_monthly' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('checkout.stripe.com');
    expect(mockSubSession).toHaveBeenCalledWith(
      TENANT_ID,
      'price_pro_monthly',
      expect.stringContaining('sucesso'),
      expect.stringContaining('cancelado')
    );
  });

  it('retorna 200 com URL para mode custom_payment', async () => {
    mockAuthSuccess();
    const res = await POST(buildRequest({ mode: 'custom_payment', customAmountCents: 5000 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain('checkout.stripe.com');
    expect(mockCreditSession).toHaveBeenCalledWith(
      TENANT_ID,
      5000,
      5000,
      expect.any(String),
      expect.any(String),
      true
    );
  });

  it('retorna 400 para mode payment quando pacote não encontrado', async () => {
    mockAuthSuccess();
    const adminMock = {
      from: vi.fn().mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } })),
    };
    mockCreateAdminClient.mockReturnValue(adminMock as any);

    const res = await POST(buildRequest({
      mode: 'payment',
      packageId: '550e8400-e29b-41d4-a716-446655440000',
    }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('package_not_found');
  });

  it('retorna 200 para mode payment quando pacote encontrado', async () => {
    mockAuthSuccess();
    const adminMock = {
      from: vi.fn().mockReturnValue(
        createQueryBuilder({ data: { price_brl_cents: 1000, credits: 1000 }, error: null })
      ),
    };
    mockCreateAdminClient.mockReturnValue(adminMock as any);

    const res = await POST(buildRequest({
      mode: 'payment',
      packageId: '550e8400-e29b-41d4-a716-446655440000',
    }));
    expect(res.status).toBe(200);
  });

  it('retorna 500 em erro inesperado', async () => {
    mockAuthSuccess();
    mockSubSession.mockRejectedValue(new Error('Unexpected'));

    const res = await POST(buildRequest({ mode: 'subscription', priceId: 'price_abc' }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('internal_error');
  });
});

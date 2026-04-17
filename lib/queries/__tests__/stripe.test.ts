import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryBuilder, createServerSupabaseMock } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import {
  getSubscriptionPlans,
  getTenantSubscription,
  getCheckoutSessions,
} from '../stripe';

const mockCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSubscriptionPlans', () => {
  it('retorna planos ativos ordenados', async () => {
    const plans = [
      { id: 'plan-1', name: 'Starter', sort_order: 1, is_active: true },
      { id: 'plan-2', name: 'Pro', sort_order: 2, is_active: true },
    ];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: plans, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getSubscriptionPlans();
    expect(result).toEqual(plans);
    expect(result).toHaveLength(2);
  });

  it('retorna array vazio em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'DB Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getSubscriptionPlans();
    expect(result).toEqual([]);
  });

  it('retorna array vazio quando não há planos', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [], error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getSubscriptionPlans();
    expect(result).toEqual([]);
  });
});

describe('getTenantSubscription', () => {
  it('retorna dados de assinatura do tenant', async () => {
    const subscription = {
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_456',
      subscription_status: 'active',
      subscription_cancel_at_period_end: false,
      subscription_provider: 'stripe',
    };
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: subscription, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getTenantSubscription('tenant-1');
    expect(result).toEqual(subscription);
    expect(result?.stripe_customer_id).toBe('cus_123');
  });

  it('retorna null em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getTenantSubscription('tenant-1');
    expect(result).toBeNull();
  });

  it('filtra pelo tenant_id correto', async () => {
    const mock = createServerSupabaseMock();
    const qb = createQueryBuilder({ data: { stripe_customer_id: 'cus_abc' }, error: null });
    mock.from.mockReturnValue(qb);
    mockCreateClient.mockResolvedValue(mock as any);

    await getTenantSubscription('tenant-xyz');
    expect(qb.eq).toHaveBeenCalledWith('id', 'tenant-xyz');
  });
});

describe('getCheckoutSessions', () => {
  it('retorna sessões de checkout do tenant', async () => {
    const sessions = [
      { id: 'cs_1', tenant_id: 'tenant-1', status: 'complete' },
      { id: 'cs_2', tenant_id: 'tenant-1', status: 'expired' },
    ];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: sessions, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getCheckoutSessions('tenant-1');
    expect(result).toEqual(sessions);
    expect(result).toHaveLength(2);
  });

  it('retorna array vazio em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getCheckoutSessions('tenant-1');
    expect(result).toEqual([]);
  });

  it('aplica limit correto na query', async () => {
    const mock = createServerSupabaseMock();
    const qb = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(qb);
    mockCreateClient.mockResolvedValue(mock as any);

    await getCheckoutSessions('tenant-1', 5);
    expect(qb.limit).toHaveBeenCalledWith(5);
  });

  it('filtra por tenant_id', async () => {
    const mock = createServerSupabaseMock();
    const qb = createQueryBuilder({ data: [], error: null });
    mock.from.mockReturnValue(qb);
    mockCreateClient.mockResolvedValue(mock as any);

    await getCheckoutSessions('tenant-abc');
    expect(qb.eq).toHaveBeenCalledWith('tenant_id', 'tenant-abc');
  });
});

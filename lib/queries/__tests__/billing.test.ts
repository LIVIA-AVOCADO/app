import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createQueryBuilder, createServerSupabaseMock } from '@/lib/__tests__/mocks/supabase';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));

import { createClient } from '@/lib/supabase/server';
import {
  getWallet,
  getLedgerEntries,
  getUsageSummaryByProvider,
  getUsageTotals,
  getBillingNotifications,
  getRechargeHistory,
  getUsedProviders,
} from '../billing';

const mockCreateClient = vi.mocked(createClient);

beforeEach(() => {
  vi.clearAllMocks();
});

// ===== WALLET =====

const baseWallet = {
  balance_credits: 1000,
  overdraft_percent: 0.1,
  hard_stop_active: false,
  low_balance_threshold_credits: 200,
};

describe('getWallet', () => {
  it('retorna null quando carteira não existe (PGRST116)', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'PGRST116' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    expect(result).toBeNull();
  });

  it('retorna null em caso de erro genérico', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { code: 'DB_ERROR' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    expect(result).toBeNull();
  });

  it('calcula balance_brl corretamente (credits / 100)', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: baseWallet, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    expect(result?.balance_brl).toBe(10); // 1000 / 100
  });

  it('calcula overdraft_amount como Math.floor(balance * percent)', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: baseWallet, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    // Math.floor(1000 * 0.1) = 100
    expect(result?.available_credits).toBe(1100);
    expect(result?.available_brl).toBe(11);
  });

  it('retorna status "ok" quando balance acima do threshold', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: baseWallet, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    expect(result?.status).toBe('ok');
  });

  it('retorna status "low" quando available_credits <= low_balance_threshold_credits', async () => {
    const lowWallet = { ...baseWallet, balance_credits: 150, overdraft_percent: 0 };
    // available = 150 + Math.floor(150 * 0) = 150, threshold = 200 → low
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: lowWallet, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    expect(result?.status).toBe('low');
  });

  it('retorna status "critical" quando hard_stop_active é true', async () => {
    const criticalWallet = { ...baseWallet, hard_stop_active: true };
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: criticalWallet, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    expect(result?.status).toBe('critical');
  });

  it('retorna status "critical" quando available_credits <= 0', async () => {
    const emptyWallet = { ...baseWallet, balance_credits: 0, overdraft_percent: 0 };
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: emptyWallet, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    expect(result?.status).toBe('critical');
  });

  it('overdraft_amount é 0 quando balance_credits é 0', async () => {
    const emptyWallet = { ...baseWallet, balance_credits: 0 };
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: emptyWallet, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    expect(result?.available_credits).toBe(0);
  });

  it('preserva todos os campos originais da wallet', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: baseWallet, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getWallet('tenant-1');
    expect(result?.balance_credits).toBe(baseWallet.balance_credits);
    expect(result?.overdraft_percent).toBe(baseWallet.overdraft_percent);
  });
});

// ===== LEDGER =====

describe('getLedgerEntries', () => {
  const mockEntries = [
    { id: 'entry-1', direction: 'debit', created_at: '2026-01-01T00:00:00Z' },
    { id: 'entry-2', direction: 'credit', created_at: '2026-01-02T00:00:00Z' },
  ];

  it('retorna entradas paginadas do tenant', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: mockEntries, error: null, count: 2 }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getLedgerEntries('tenant-1');
    expect(result.entries).toEqual(mockEntries);
    expect(result.total).toBe(2);
  });

  it('calcula totalPages corretamente', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: mockEntries, error: null, count: 100 }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getLedgerEntries('tenant-1', {}, 10, 1);
    expect(result.totalPages).toBe(10); // 100 / 10
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
  });

  it('retorna resultado vazio em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'DB Error' }, count: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getLedgerEntries('tenant-1');
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('retorna entries vazio quando data é null sem erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: null, count: 0 }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getLedgerEntries('tenant-1');
    expect(result.entries).toEqual([]);
  });
});

// ===== USAGE SUMMARY (lógica de agrupamento JS) =====

describe('getUsageSummaryByProvider', () => {
  it('retorna array vazio em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsageSummaryByProvider('tenant-1');
    expect(result).toEqual([]);
  });

  it('agrupa por provider+sku e soma calls e credits', async () => {
    const rows = [
      { provider: 'openai', sku: 'gpt-4', debited_credits: 100, created_at: '2026-01-01' },
      { provider: 'openai', sku: 'gpt-4', debited_credits: 200, created_at: '2026-01-02' },
      { provider: 'openai', sku: 'gpt-3.5', debited_credits: 50, created_at: '2026-01-01' },
    ];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: rows, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsageSummaryByProvider('tenant-1');
    const gpt4 = result.find((r) => r.sku === 'gpt-4');
    expect(gpt4?.calls).toBe(2);
    expect(gpt4?.debited_credits).toBe(300);
    expect(gpt4?.debited_brl).toBe(3); // 300 / 100
  });

  it('ordena por debited_credits decrescente', async () => {
    const rows = [
      { provider: 'openai', sku: 'gpt-3.5', debited_credits: 50, created_at: '2026-01-01' },
      { provider: 'openai', sku: 'gpt-4', debited_credits: 300, created_at: '2026-01-01' },
    ];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: rows, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsageSummaryByProvider('tenant-1');
    expect(result[0].sku).toBe('gpt-4');
    expect(result[1].sku).toBe('gpt-3.5');
  });

  it('usa "unknown" para sku nulo', async () => {
    const rows = [{ provider: 'openai', sku: null, debited_credits: 100, created_at: '2026-01-01' }];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: rows, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsageSummaryByProvider('tenant-1');
    expect(result[0].sku).toBe('unknown');
  });

  it('ignora linhas sem provider', async () => {
    const rows = [{ provider: null, sku: 'test', debited_credits: 100, created_at: '2026-01-01' }];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: rows, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsageSummaryByProvider('tenant-1');
    expect(result).toEqual([]);
  });
});

// ===== USAGE TOTALS =====

describe('getUsageTotals', () => {
  it('soma debited_credits corretamente', async () => {
    const rows = [{ debited_credits: 100 }, { debited_credits: 250 }, { debited_credits: 50 }];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: rows, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsageTotals('tenant-1');
    expect(result.total_credits).toBe(400);
    expect(result.total_brl).toBe(4); // 400 / 100
    expect(result.calls).toBe(3);
  });

  it('retorna zeros em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsageTotals('tenant-1');
    expect(result).toEqual({ total_credits: 0, total_brl: 0, calls: 0 });
  });

  it('trata debited_credits nulo como 0', async () => {
    const rows = [{ debited_credits: null }, { debited_credits: 100 }];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: rows, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsageTotals('tenant-1');
    expect(result.total_credits).toBe(100);
  });

  it('retorna zeros quando não há dados', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: [], error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsageTotals('tenant-1');
    expect(result).toEqual({ total_credits: 0, total_brl: 0, calls: 0 });
  });
});

// ===== NOTIFICATIONS =====

describe('getBillingNotifications', () => {
  it('retorna notificações do tenant', async () => {
    const notifications = [{ id: 'notif-1' }, { id: 'notif-2' }];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: notifications, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getBillingNotifications('tenant-1');
    expect(result).toEqual(notifications);
  });

  it('retorna array vazio em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getBillingNotifications('tenant-1');
    expect(result).toEqual([]);
  });
});

// ===== RECHARGE HISTORY =====

describe('getRechargeHistory', () => {
  it('retorna histórico de recargas', async () => {
    const entries = [{ id: 'entry-1', direction: 'credit', source_type: 'purchase' }];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: entries, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getRechargeHistory('tenant-1');
    expect(result).toEqual(entries);
  });

  it('retorna array vazio em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getRechargeHistory('tenant-1');
    expect(result).toEqual([]);
  });
});

// ===== PROVIDERS =====

describe('getUsedProviders', () => {
  it('retorna providers únicos', async () => {
    const rows = [{ provider: 'openai' }, { provider: 'openai' }, { provider: 'anthropic' }];
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: rows, error: null }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsedProviders('tenant-1');
    expect(result).toHaveLength(2);
    expect(result).toContain('openai');
    expect(result).toContain('anthropic');
  });

  it('retorna array vazio em caso de erro', async () => {
    const mock = createServerSupabaseMock();
    mock.from.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'Error' } }));
    mockCreateClient.mockResolvedValue(mock as any);

    const result = await getUsedProviders('tenant-1');
    expect(result).toEqual([]);
  });
});

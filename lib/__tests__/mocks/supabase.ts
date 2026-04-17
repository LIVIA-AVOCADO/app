import { vi } from 'vitest';

/**
 * Cria um query builder mockado e "awaitable" (thenable).
 * Suporta tanto .single() quanto await direto na chain.
 *
 * IMPORTANTE: o mock principal (supabase) não pode ser thenable,
 * pois Promise.resolve(thenable) assimila o then — isso causaria problemas
 * no `const supabase = await createClient()`.
 * Por isso, apenas o query builder (retornado por .from()) é thenable.
 */
export function createQueryBuilder(
  result: { data: unknown; error: unknown; count?: number | null } = { data: null, error: null }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    // Torna o builder awaitable para queries sem .single()
    then: (resolve: (v: unknown) => void, reject: (r: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

/**
 * Cria um mock do Supabase server-side (createClient async).
 * - from() retorna um query builder thenable configurável.
 * - rpc() retorna uma Promise configurável.
 */
export function createServerSupabaseMock(
  defaultResult: { data: unknown; error: unknown; count?: number | null } = { data: null, error: null }
) {
  return {
    from: vi.fn().mockReturnValue(createQueryBuilder(defaultResult)),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  };
}

/**
 * Mock do Supabase Client (client-side, síncrono)
 *
 * Simula as operações mais comuns do Supabase para testes unitários:
 * - Queries (from, select, eq, neq, in, order, limit, single)
 * - Realtime (channel, on, subscribe, removeChannel)
 */
export const createMockSupabaseClient = () => ({
  // Queries
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  single: vi.fn(),

  // Realtime
  channel: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
  removeChannel: vi.fn(),

  // Auth
  auth: {
    getUser: vi.fn(),
    getSession: vi.fn(),
  },
});

/**
 * Mock de RealtimeChannel
 */
export const createMockRealtimeChannel = () => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
});

/**
 * Mock de payload de evento realtime
 */
export const createMockRealtimePayload = <T>(data: T, old?: Partial<T>) => ({
  new: data,
  old: old || {},
  eventType: 'INSERT' as const,
  schema: 'public',
  table: 'test',
  commit_timestamp: new Date().toISOString(),
});

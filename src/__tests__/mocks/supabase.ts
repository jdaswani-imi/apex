import { vi } from 'vitest'

/**
 * Creates a chainable + thenable Supabase query builder mock.
 * The builder supports: .from().select().eq().single() etc.
 * Each instance resolves to { data, error } when awaited.
 */
export function makeQueryBuilder(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const builder: Record<string, unknown> = {}

  const methods = [
    'select', 'insert', 'upsert', 'update', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in',
    'order', 'limit', 'range', 'single', 'maybeSingle',
    'filter', 'match', 'or', 'not', 'overlaps',
    'textSearch', 'contains', 'containedBy', 'is',
    'returns', 'throwOnError',
  ]

  const self = new Proxy(builder, {
    get(target, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(result)
      }
      if (prop in target) return target[prop]
      // Return a spy that returns self so calls are chainable
      target[prop] = vi.fn(() => self)
      return target[prop]
    },
  })

  for (const m of methods) {
    builder[m] = vi.fn(() => self)
  }

  return self as ReturnType<typeof vi.fn> & Record<string, ReturnType<typeof vi.fn>>
}

/**
 * Creates a fully mocked Supabase client.
 * Pass `userData` for auth.getUser() responses.
 * Pass `queryResult` as the default for all query chains.
 */
export function makeSupabaseMock(
  opts: {
    user?: { id: string; email?: string } | null
    queryResult?: { data: unknown; error: unknown }
    authError?: unknown
  } = {},
) {
  const { user = { id: 'user-123', email: 'test@test.com' }, queryResult, authError } = opts

  const defaultResult = queryResult ?? { data: null, error: null }

  const queryBuilder = makeQueryBuilder(defaultResult)

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authError ? null : user },
        error: authError ?? null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(() => queryBuilder),
    rpc: vi.fn().mockResolvedValue(defaultResult),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file' } }),
      })),
    },
  }

  return { client, queryBuilder }
}

/**
 * Shorthand: make an unauthenticated Supabase mock (user: null).
 */
export function makeUnauthSupabase() {
  return makeSupabaseMock({ user: null })
}

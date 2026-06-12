import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSupabaseMock, makeUnauthSupabase } from '../mocks/supabase'
import { createClient } from '@/lib/supabase/server'
import { getFullUserContext } from '@/lib/db'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/db', () => ({ getFullUserContext: vi.fn() }))

const mockCreateClient = vi.mocked(createClient)
const mockGetFullUserContext = vi.mocked(getFullUserContext)

function makePostRequest(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

async function importRoute() {
  const mod = await import('@/app/api/settings/route')
  return mod
}

describe('GET /api/settings', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('returns full user context when authenticated', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)
    const fakeCtx = { profile: { name: 'Jason' }, goals: [] }
    mockGetFullUserContext.mockResolvedValue(fakeCtx as never)

    const { GET } = await importRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockGetFullUserContext).toHaveBeenCalledOnce()
    expect(json).toEqual(fakeCtx)
  })
})

describe('POST /api/settings', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ table: 'user_profile', data: {} }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 for an invalid table', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ table: 'evil_table', data: {} }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'Invalid table' })
  })

  it.each([
    ['user_profile', { name: 'Jason' }],
    ['user_goals', { target_weight_kg: 70 }],
    ['user_training', { gym_name: 'TopGym' }],
    ['user_lifestyle', { diet_type: 'vegetarian' }],
  ] as const)(
    'accepts table "%s", keeps allowed fields, and returns success',
    async (table, validField) => {
      vi.resetModules()
      vi.clearAllMocks()
      const { client, queryBuilder } = makeSupabaseMock()
      mockCreateClient.mockResolvedValue(client as never)

      const { POST } = await importRoute()
      const res = await POST(makePostRequest({ table, data: validField }))
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json).toEqual({ success: true })
      expect(client.from).toHaveBeenCalledWith(table)
      expect(queryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 'user-123', ...validField }),
      )
    },
  )

  it('strips disallowed fields and cannot override user_id (mass-assignment guard)', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(
      makePostRequest({
        table: 'user_profile',
        data: { name: 'Jason', api_token: 'attacker', user_id: 'someone-else', foo: 'bar' },
      }),
    )

    expect(res.status).toBe(200)
    const upserted = queryBuilder.upsert.mock.calls[0][0] as Record<string, unknown>
    expect(upserted.name).toBe('Jason')
    expect(upserted.user_id).toBe('user-123')
    expect(upserted).not.toHaveProperty('api_token')
    expect(upserted).not.toHaveProperty('foo')
  })

  it('returns 500 when upsert fails', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: { message: 'DB exploded' } } })
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ table: 'user_profile', data: {} }))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json).toEqual({ error: 'DB exploded' })
  })

  it('returns { success: true } on a successful upsert', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ table: 'user_goals', data: { goal: 'run 5k' } }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
  })
})

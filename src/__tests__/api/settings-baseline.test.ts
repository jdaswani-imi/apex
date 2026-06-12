import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSupabaseMock, makeUnauthSupabase } from '../mocks/supabase'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const mockCreateClient = vi.mocked(createClient)

function makePostRequest(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

function makeThrowingRequest(): Request {
  return { json: () => Promise.reject(new SyntaxError('Unexpected token')) } as Request
}

async function importRoute() {
  const mod = await import('@/app/api/settings/baseline/route')
  return mod
}

describe('POST /api/settings/baseline', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ id: '1' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 when id is missing', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ exercise_name: 'Squat' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'id is required' })
  })

  it('calls update with only allowed fields', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(
      makePostRequest({
        id: 'baseline-42',
        exercise_name: 'Deadlift',
        current_weight_kg: 100,
        current_reps: 5,
        current_sets: 3,
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(client.from).toHaveBeenCalledWith('exercise_baselines')
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        exercise_name: 'Deadlift',
        current_weight_kg: 100,
        current_reps: 5,
        current_sets: 3,
      }),
    )
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'baseline-42')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('strips disallowed fields before update', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    await POST(
      makePostRequest({
        id: 'baseline-42',
        exercise_name: 'Bench Press',
        malicious_field: 'DROP TABLE',
        another_bad: true,
        notes: 'legit note',
      }),
    )

    const updateArg = (queryBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateArg).toHaveProperty('exercise_name', 'Bench Press')
    expect(updateArg).toHaveProperty('notes', 'legit note')
    expect(updateArg).not.toHaveProperty('malicious_field')
    expect(updateArg).not.toHaveProperty('another_bad')
  })

  it('returns { success: true } on success', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ id: 'x', target_reps: 10, target_weight_kg: 80 }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
  })

  it('returns 400 when body is empty (no id key)', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({}))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'id is required' })
    expect(queryBuilder.update).not.toHaveBeenCalled()
  })

  it('returns 400 when id is explicitly null', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ id: null, exercise_name: 'Squat' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'id is required' })
    expect(queryBuilder.update).not.toHaveBeenCalled()
  })

  it('returns 400 when id is 0 (falsy number)', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ id: 0, exercise_name: 'Squat' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'id is required' })
    expect(queryBuilder.update).not.toHaveBeenCalled()
  })

  it('propagates unhandled rejection when request.json() throws', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    await expect(POST(makeThrowingRequest())).rejects.toThrow(SyntaxError)
  })

  it('still returns success:true even when supabase update returns an error', async () => {
    const { client, queryBuilder } = makeSupabaseMock({
      queryResult: { data: null, error: { message: 'DB error', code: '42P01' } },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ id: 'baseline-99', exercise_name: 'Squat' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(queryBuilder.update).toHaveBeenCalled()
  })

  it('passes session_type through to the update payload', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(
      makePostRequest({
        id: 'baseline-55',
        session_type: 'strength',
        exercise_name: 'Pull-up',
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    const updateArg = (queryBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateArg).toHaveProperty('session_type', 'strength')
    expect(updateArg).toHaveProperty('exercise_name', 'Pull-up')
  })

  it('always includes updated_at in the update payload', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const before = Date.now()
    const { POST } = await importRoute()
    await POST(makePostRequest({ id: 'baseline-77', exercise_name: 'Row' }))
    const after = Date.now()

    const updateArg = (queryBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(updateArg).toHaveProperty('updated_at')
    const updatedAt = new Date(updateArg.updated_at as string).getTime()
    expect(updatedAt).toBeGreaterThanOrEqual(before)
    expect(updatedAt).toBeLessThanOrEqual(after)
  })

  it('calls update with only updated_at when body contains only disallowed fields', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(
      makePostRequest({
        id: 'baseline-88',
        bad_field: 'value',
        another_bad: 123,
        user_id: 'injected-user',
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    const updateArg = (queryBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(updateArg)).toEqual(['updated_at'])
    expect(updateArg).not.toHaveProperty('bad_field')
    expect(updateArg).not.toHaveProperty('another_bad')
    expect(updateArg).not.toHaveProperty('user_id')
  })

  it('does not export GET, PUT, or DELETE handlers', async () => {
    const mod = await importRoute()
    expect((mod as Record<string, unknown>).GET).toBeUndefined()
    expect((mod as Record<string, unknown>).PUT).toBeUndefined()
    expect((mod as Record<string, unknown>).DELETE).toBeUndefined()
  })
})

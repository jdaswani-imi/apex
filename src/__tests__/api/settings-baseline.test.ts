import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSupabaseMock, makeUnauthSupabase } from '../mocks/supabase'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const mockCreateClient = vi.mocked(createClient)

function makePostRequest(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
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
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeQueryBuilder, makeSupabaseMock, makeUnauthSupabase } from '../mocks/supabase'
import { createClient } from '@/lib/supabase/server'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

const mockCreateClient = vi.mocked(createClient)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body?: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

/** Wrap a resolved id string as the dynamic params shape Next.js passes. */
function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

async function importSessionRoute() {
  return import('@/app/api/training/session/[id]/route')
}

async function importExerciseRoute() {
  return import('@/app/api/training/exercise/route')
}

// ---------------------------------------------------------------------------
// training/session/[id] — GET
// ---------------------------------------------------------------------------

describe('GET /api/training/session/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when no user', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importSessionRoute()
    const res = await GET(makeRequest(), makeParams('sess-1'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('queries training_sessions scoped to user and returns data', async () => {
    const sessionData = { id: 'sess-1', user_id: 'user-123', exercises: [] }
    const { client, queryBuilder } = makeSupabaseMock({
      queryResult: { data: sessionData, error: null },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importSessionRoute()
    const res = await GET(makeRequest(), makeParams('sess-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(sessionData)

    // Verify the query chain was built correctly
    expect(client.from).toHaveBeenCalledWith('training_sessions')
    expect(queryBuilder.select).toHaveBeenCalledWith('*, exercises(*)')
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'sess-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(queryBuilder.single).toHaveBeenCalled()
  })

  it('returns null data (no session found) as JSON without error status', async () => {
    const { client } = makeSupabaseMock({
      queryResult: { data: null, error: { code: 'PGRST116' } },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importSessionRoute()
    const res = await GET(makeRequest(), makeParams('nonexistent'))
    const json = await res.json()

    // The route doesn't explicitly handle DB errors — it just returns data
    expect(res.status).toBe(200)
    expect(json).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// training/session/[id] — DELETE
// ---------------------------------------------------------------------------

describe('DELETE /api/training/session/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when no user', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importSessionRoute()
    const res = await DELETE(makeRequest(), makeParams('sess-1'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('returns 404 when session not owned by user', async () => {
    // from() always returns builder whose .single() resolves to { data: null }
    const { client } = makeSupabaseMock({
      queryResult: { data: null, error: null },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importSessionRoute()
    const res = await DELETE(makeRequest(), makeParams('sess-not-mine'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Not found' })
  })

  it('deletes exercises then session and returns { ok: true }', async () => {
    // First from('training_sessions') call → ownership check → returns session
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    // Second from('exercises') call → delete exercises
    const exercisesDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    // Third from('training_sessions') call → delete session
    const sessionDeleteBuilder = makeQueryBuilder({ data: null, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)   // SELECT id ownership check
        .mockReturnValueOnce(exercisesDeleteBuilder) // DELETE exercises
        .mockReturnValueOnce(sessionDeleteBuilder),  // DELETE training_sessions
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importSessionRoute()
    const res = await DELETE(makeRequest(), makeParams('sess-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })

    expect(client.from).toHaveBeenNthCalledWith(1, 'training_sessions')
    expect(client.from).toHaveBeenNthCalledWith(2, 'exercises')
    expect(client.from).toHaveBeenNthCalledWith(3, 'training_sessions')

    // Exercises delete: .delete().eq('session_id', id)
    expect(exercisesDeleteBuilder.delete).toHaveBeenCalled()
    expect(exercisesDeleteBuilder.eq).toHaveBeenCalledWith('session_id', 'sess-1')

    // Session delete: .delete().eq('id', id).eq('user_id', user.id)
    expect(sessionDeleteBuilder.delete).toHaveBeenCalled()
    expect(sessionDeleteBuilder.eq).toHaveBeenCalledWith('id', 'sess-1')
    expect(sessionDeleteBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('does not delete when auth passes but ownership check returns null data', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: null, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn().mockReturnValue(ownershipBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importSessionRoute()
    const res = await DELETE(makeRequest(), makeParams('sess-other'))
    const json = await res.json()

    expect(res.status).toBe(404)
    // from() should only be called once (the ownership check)
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(json).toEqual({ error: 'Not found' })
  })
})

// ---------------------------------------------------------------------------
// training/session/[id] — PATCH
// ---------------------------------------------------------------------------

describe('PATCH /api/training/session/[id]', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when no user', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { PATCH } = await importSessionRoute()
    const res = await PATCH(makeRequest({}), makeParams('sess-1'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('updates allowed fields and returns result', async () => {
    const updated = { id: 'sess-1', notes: 'great session', duration_min: 60 }
    const { client, queryBuilder } = makeSupabaseMock({
      queryResult: { data: updated, error: null },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const body = { notes: 'great session', duration_min: 60 }
    const { PATCH } = await importSessionRoute()
    const res = await PATCH(makeRequest(body), makeParams('sess-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(updated)

    expect(client.from).toHaveBeenCalledWith('training_sessions')
    expect(queryBuilder.update).toHaveBeenCalledWith({ notes: 'great session', duration_min: 60 })
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'sess-1')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('strips disallowed fields from the update payload', async () => {
    const { client, queryBuilder } = makeSupabaseMock({
      queryResult: { data: { id: 'sess-1' }, error: null },
    })
    mockCreateClient.mockResolvedValue(client as never)

    // 'user_id' and 'malicious' are not in ALLOWED_SESSION_UPDATE_FIELDS
    const body = { notes: 'safe', user_id: 'hacker', malicious: 'drop table' }
    const { PATCH } = await importSessionRoute()
    await PATCH(makeRequest(body), makeParams('sess-1'))

    expect(queryBuilder.update).toHaveBeenCalledWith({ notes: 'safe' })
  })

  it('allows all whitelisted fields through', async () => {
    const { client, queryBuilder } = makeSupabaseMock({
      queryResult: { data: {}, error: null },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const allAllowed = {
      date: '2026-01-01',
      session_type: 'strength',
      gym: 'Main Gym',
      duration_min: 45,
      volume_kg: 3000,
      prs: 2,
      whoop_strain: 14.5,
      notes: 'pb day',
      finished_at: '2026-01-01T10:00:00Z',
      photo_url: 'https://example.com/photo.jpg',
    }
    const { PATCH } = await importSessionRoute()
    await PATCH(makeRequest(allAllowed), makeParams('sess-1'))

    expect(queryBuilder.update).toHaveBeenCalledWith(allAllowed)
  })

  it('sends empty object when body has only disallowed fields', async () => {
    const { client, queryBuilder } = makeSupabaseMock({
      queryResult: { data: null, error: null },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { PATCH } = await importSessionRoute()
    await PATCH(makeRequest({ user_id: 'hack', id: 'override' }), makeParams('sess-1'))

    expect(queryBuilder.update).toHaveBeenCalledWith({})
  })
})

// ---------------------------------------------------------------------------
// training/exercise — POST
// ---------------------------------------------------------------------------

describe('POST /api/training/exercise', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when no user', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    const res = await POST(makeRequest({ session_id: 's1', name: 'Squat' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 when session_id is missing', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    const res = await POST(makeRequest({ name: 'Squat' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'session_id and name are required' })
  })

  it('returns 400 when name is missing', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    const res = await POST(makeRequest({ session_id: 'sess-1' }))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'session_id and name are required' })
  })

  it('returns 400 when both session_id and name are missing', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    const res = await POST(makeRequest({}))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'session_id and name are required' })
  })

  it('returns 404 when session not found for user', async () => {
    // from('training_sessions') → ownership check returns null
    const ownershipBuilder = makeQueryBuilder({ data: null, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn().mockReturnValue(ownershipBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    const res = await POST(makeRequest({ session_id: 'sess-other', name: 'Bench' }))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json).toEqual({ error: 'Session not found' })
    // Only the ownership check query, no insert
    expect(client.from).toHaveBeenCalledTimes(1)
    expect(client.from).toHaveBeenCalledWith('training_sessions')
  })

  it('inserts exercise and returns result (no PR)', async () => {
    const exerciseRow = { id: 'ex-1', session_id: 'sess-1', name: 'Squat', reps: 5 }

    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({ data: exerciseRow, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)  // SELECT id from training_sessions
        .mockReturnValueOnce(insertBuilder),     // INSERT into exercises
    }
    mockCreateClient.mockResolvedValue(client as never)

    const body = { session_id: 'sess-1', name: 'Squat', reps: 5, weight_kg: 100 }
    const { POST } = await importExerciseRoute()
    const res = await POST(makeRequest(body))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(exerciseRow)

    expect(client.from).toHaveBeenNthCalledWith(1, 'training_sessions')
    expect(client.from).toHaveBeenNthCalledWith(2, 'exercises')
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: 'sess-1', name: 'Squat', reps: 5, weight_kg: 100 })
    )
    // No PR update — from() called only twice
    expect(client.from).toHaveBeenCalledTimes(2)
  })

  it('updates exercise_baselines when is_pr is truthy', async () => {
    const exerciseRow = { id: 'ex-2', session_id: 'sess-1', name: 'Deadlift', is_pr: true }

    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({ data: exerciseRow, error: null })
    const baselineBuilder = makeQueryBuilder({ data: null, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)  // SELECT id ownership check
        .mockReturnValueOnce(insertBuilder)      // INSERT exercise
        .mockReturnValueOnce(baselineBuilder),   // UPDATE exercise_baselines
    }
    mockCreateClient.mockResolvedValue(client as never)

    const body = {
      session_id: 'sess-1',
      name: 'Deadlift',
      is_pr: true,
      weight_kg: 200,
      reps: 1,
    }
    const { POST } = await importExerciseRoute()
    const res = await POST(makeRequest(body))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(exerciseRow)

    expect(client.from).toHaveBeenNthCalledWith(3, 'exercise_baselines')
    expect(baselineBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        current_weight_kg: 200,
        current_reps: 1,
      })
    )
    expect(baselineBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(baselineBuilder.ilike).toHaveBeenCalledWith('exercise_name', '%Deadlift%')
  })

  it('does NOT update exercise_baselines when is_pr is falsy', async () => {
    const exerciseRow = { id: 'ex-3', session_id: 'sess-1', name: 'OHP', is_pr: false }

    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({ data: exerciseRow, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(insertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    await POST(makeRequest({ session_id: 'sess-1', name: 'OHP', is_pr: false, weight_kg: 60, reps: 8 }))

    // Only 2 calls — no baseline update
    expect(client.from).toHaveBeenCalledTimes(2)
    expect(client.from).not.toHaveBeenCalledWith('exercise_baselines')
  })

  it('strips disallowed fields from insert payload', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({ data: { id: 'ex-4' }, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(insertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const body = {
      session_id: 'sess-1',
      name: 'Curl',
      reps: 10,
      user_id: 'hacker',       // disallowed
      malicious: 'drop table', // disallowed
    }
    const { POST } = await importExerciseRoute()
    await POST(makeRequest(body))

    // Payload passed to insert must NOT contain disallowed keys
    const insertCall = insertBuilder.insert.mock.calls[0][0]
    expect(insertCall).not.toHaveProperty('user_id')
    expect(insertCall).not.toHaveProperty('malicious')
    expect(insertCall).toHaveProperty('session_id', 'sess-1')
    expect(insertCall).toHaveProperty('name', 'Curl')
    expect(insertCall).toHaveProperty('reps', 10)
  })

  it('allows all whitelisted exercise fields through', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({ data: { id: 'ex-5' }, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(insertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const allAllowed = {
      session_id: 'sess-1',
      name: 'Bench Press',
      set_number: 1,
      set_type: 'working',
      weight_kg: 80,
      reps: 5,
      sets: 3,
      is_pr: false,
      is_completed: true,
      notes: 'felt easy',
      rest_seconds: 120,
      duration_sec: 30,
      distance_m: 0,
    }
    const { POST } = await importExerciseRoute()
    await POST(makeRequest(allAllowed))

    expect(insertBuilder.insert).toHaveBeenCalledWith(allAllowed)
  })
})

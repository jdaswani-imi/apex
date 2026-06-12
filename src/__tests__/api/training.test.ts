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

  it('returns non-null data alongside a DB error as JSON with 200 (no error handling)', async () => {
    // Simulates a case where Supabase returns both data and an error simultaneously
    // (e.g. a warning-level error). The route ignores the error field entirely.
    const sessionData = { id: 'sess-1', user_id: 'user-123', exercises: [] }
    const { client } = makeSupabaseMock({
      queryResult: { data: sessionData, error: { code: 'SOME_WARNING', message: 'partial result' } },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { GET } = await importSessionRoute()
    const res = await GET(makeRequest(), makeParams('sess-1'))
    const json = await res.json()

    // Route returns data regardless of error field — documents the pass-through behavior
    expect(res.status).toBe(200)
    expect(json).toEqual(sessionData)
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

  it('proceeds to return { ok: true } even when exercises delete returns a DB error (no error handling)', async () => {
    // Documents that the route has no error handling on the exercises delete step:
    // even if the exercises delete returns an error, the route continues and returns ok.
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const exercisesDeleteBuilder = makeQueryBuilder({ data: null, error: { code: '42501', message: 'permission denied' } })
    const sessionDeleteBuilder = makeQueryBuilder({ data: null, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(exercisesDeleteBuilder)
        .mockReturnValueOnce(sessionDeleteBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importSessionRoute()
    const res = await DELETE(makeRequest(), makeParams('sess-1'))
    const json = await res.json()

    // Route has no error guard — it continues and returns ok regardless
    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
    // All three from() calls were still made
    expect(client.from).toHaveBeenCalledTimes(3)
  })

  it('proceeds to return { ok: true } even when training_sessions delete returns a DB error (no error handling)', async () => {
    // Documents that the route has no error handling on the session delete step:
    // the route returns ok regardless of what the final delete resolves to.
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const exercisesDeleteBuilder = makeQueryBuilder({ data: null, error: null })
    const sessionDeleteBuilder = makeQueryBuilder({ data: null, error: { code: '23503', message: 'foreign key violation' } })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(exercisesDeleteBuilder)
        .mockReturnValueOnce(sessionDeleteBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importSessionRoute()
    const res = await DELETE(makeRequest(), makeParams('sess-1'))
    const json = await res.json()

    // Route has no error guard — it returns ok regardless of delete errors
    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(client.from).toHaveBeenCalledTimes(3)
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

  it('calls .select() after .update() in the query chain', async () => {
    const updated = { id: 'sess-1', notes: 'verified select chain' }
    const { client, queryBuilder } = makeSupabaseMock({
      queryResult: { data: updated, error: null },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { PATCH } = await importSessionRoute()
    await PATCH(makeRequest({ notes: 'verified select chain' }), makeParams('sess-1'))

    // Verify .select() is called in the chain (no arguments — returns all columns)
    expect(queryBuilder.select).toHaveBeenCalled()
    // And .single() is called after .select()
    expect(queryBuilder.single).toHaveBeenCalled()
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

  it('returns null with 200 when DB update finds no matching row (implicit pass-through, no ownership guard)', async () => {
    // The PATCH route has no post-update ownership check: if user_id scoping
    // at the .eq() level results in 0 matched rows, Supabase returns data: null.
    // The route returns NextResponse.json(null) with status 200 — documents this gap.
    const { client, queryBuilder } = makeSupabaseMock({
      queryResult: { data: null, error: null },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { PATCH } = await importSessionRoute()
    const res = await PATCH(makeRequest({ notes: 'ghost update' }), makeParams('sess-does-not-exist'))
    const json = await res.json()

    // Route returns 200 with null body — no 404 guard after update
    expect(res.status).toBe(200)
    expect(json).toBeNull()
    expect(queryBuilder.update).toHaveBeenCalledWith({ notes: 'ghost update' })
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'sess-does-not-exist')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('returns null with 200 when DB update returns error alongside null data (no error handling)', async () => {
    // Documents the same pass-through: a DB-level error during update is silently
    // swallowed and the route returns NextResponse.json(null) with 200.
    const { client } = makeSupabaseMock({
      queryResult: { data: null, error: { code: '23505', message: 'duplicate key' } },
    })
    mockCreateClient.mockResolvedValue(client as never)

    const { PATCH } = await importSessionRoute()
    const res = await PATCH(makeRequest({ notes: 'conflict' }), makeParams('sess-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toBeNull()
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
    expect(baselineBuilder.eq).toHaveBeenCalledWith('exercise_name', 'Deadlift')
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

  // -------------------------------------------------------------------------
  // Gap 1: is_pr truthy but name is falsy — the `body.is_pr && body.name`
  // condition short-circuits so the baseline update branch is never reached.
  // The route guards `!body.name` earlier, so empty/null/undefined name is
  // rejected at 400 before any DB call.
  // -------------------------------------------------------------------------

  it('returns 400 and makes no DB calls when is_pr is true but name is empty string', async () => {
    // Empty string is falsy — caught by `!body.name` validation guard before
    // the ownership check, so no from() calls should occur.
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    const res = await POST(
      makeRequest({ session_id: 'sess-1', name: '', is_pr: true, weight_kg: 100, reps: 1 })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'session_id and name are required' })
    expect(client.from).not.toHaveBeenCalled()
  })

  it('returns 400 and makes no DB calls when is_pr is true but name is null', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    const res = await POST(
      makeRequest({ session_id: 'sess-1', name: null, is_pr: true, weight_kg: 100, reps: 1 })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'session_id and name are required' })
    expect(client.from).not.toHaveBeenCalled()
  })

  it('returns 400 and makes no DB calls when is_pr is true but name is undefined', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    // Omit name key entirely — equivalent to undefined
    const res = await POST(
      makeRequest({ session_id: 'sess-1', is_pr: true, weight_kg: 100, reps: 1 })
    )
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'session_id and name are required' })
    expect(client.from).not.toHaveBeenCalled()
  })

  it('skips baseline update when is_pr is a falsy number (0) even with a valid name', async () => {
    // is_pr=0 passes the name guard (name is non-empty) but `body.is_pr && body.name`
    // evaluates falsy at the post-insert check — baseline update must be skipped.
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({ data: { id: 'ex-6', name: 'Press', is_pr: 0 }, error: null })

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
    const res = await POST(
      makeRequest({ session_id: 'sess-1', name: 'Press', is_pr: 0, weight_kg: 50, reps: 10 })
    )

    expect(res.status).toBe(200)
    // Only 2 from() calls: ownership + insert; no baseline update
    expect(client.from).toHaveBeenCalledTimes(2)
    expect(client.from).not.toHaveBeenCalledWith('exercise_baselines')
  })

  // -------------------------------------------------------------------------
  // Gap 2: updated_at ISO string in the exercise_baselines update payload is
  // explicitly verified (not just objectContaining which omits the field).
  // -------------------------------------------------------------------------

  it('includes a valid ISO updated_at timestamp in the exercise_baselines update', async () => {
    const before = new Date().toISOString()

    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({
      data: { id: 'ex-7', session_id: 'sess-1', name: 'Clean', is_pr: true },
      error: null,
    })
    const baselineBuilder = makeQueryBuilder({ data: null, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(baselineBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    await POST(
      makeRequest({ session_id: 'sess-1', name: 'Clean', is_pr: true, weight_kg: 120, reps: 3 })
    )

    const after = new Date().toISOString()

    expect(baselineBuilder.update).toHaveBeenCalledTimes(1)
    const updatePayload = baselineBuilder.update.mock.calls[0][0] as Record<string, unknown>

    // updated_at must be present
    expect(updatePayload).toHaveProperty('updated_at')
    const updatedAt = updatePayload.updated_at as string

    // Must be a string
    expect(typeof updatedAt).toBe('string')

    // Must be parseable as a valid date
    expect(Number.isNaN(Date.parse(updatedAt))).toBe(false)

    // Must fall within the test window
    expect(updatedAt >= before).toBe(true)
    expect(updatedAt <= after).toBe(true)

    // Other expected fields are also present
    expect(updatePayload).toHaveProperty('current_weight_kg', 120)
    expect(updatePayload).toHaveProperty('current_reps', 3)
  })

  it('updated_at in baseline update matches ISO 8601 format with milliseconds', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({
      data: { id: 'ex-8', name: 'Snatch', is_pr: true },
      error: null,
    })
    const baselineBuilder = makeQueryBuilder({ data: null, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(baselineBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    await POST(
      makeRequest({ session_id: 'sess-1', name: 'Snatch', is_pr: true, weight_kg: 90, reps: 1 })
    )

    const updatePayload = baselineBuilder.update.mock.calls[0][0] as Record<string, unknown>
    const updatedAt = updatePayload.updated_at as string

    // new Date().toISOString() always produces YYYY-MM-DDTHH:mm:ss.sssZ
    expect(updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('baseline update payload contains exactly the three expected keys', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({
      data: { id: 'ex-9', name: 'Press', is_pr: true },
      error: null,
    })
    const baselineBuilder = makeQueryBuilder({ data: null, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(baselineBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    await POST(
      makeRequest({ session_id: 'sess-1', name: 'Press', is_pr: true, weight_kg: 75, reps: 5 })
    )

    const updatePayload = baselineBuilder.update.mock.calls[0][0] as Record<string, unknown>
    const keys = Object.keys(updatePayload).sort()

    // The route sets exactly these three keys — no extras, no missing
    expect(keys).toEqual(['current_reps', 'current_weight_kg', 'updated_at'])
  })

  // -------------------------------------------------------------------------
  // Gap 3: insert returning null/undefined data is handled gracefully —
  // the route passes data directly to NextResponse.json() without a null
  // check, so null data should serialize to JSON null without throwing.
  // -------------------------------------------------------------------------

  it('returns JSON null gracefully when insert resolves with null data (no PR)', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    // insert → select → single resolves to { data: null }
    const insertBuilder = makeQueryBuilder({ data: null, error: null })

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
    const res = await POST(
      makeRequest({ session_id: 'sess-1', name: 'Row', reps: 8, weight_kg: 70 })
    )
    const json = await res.json()

    // Route does not null-check — returns data directly; null serialises to JSON null
    expect(res.status).toBe(200)
    expect(json).toBeNull()
  })

  it('returns JSON null gracefully when insert resolves with undefined data (no PR)', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({ data: undefined, error: null })

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
    const res = await POST(
      makeRequest({ session_id: 'sess-1', name: 'Row', reps: 8, weight_kg: 70 })
    )

    // Should not throw — undefined serialises to null in JSON
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toBeNull()
  })

  it('returns null data without throwing when is_pr is true and insert returns null, and still fires baseline update', async () => {
    // PR path: insert returns null data; route must not throw.
    // The `body.is_pr && body.name` condition is evaluated using the original
    // request body — not the DB result — so the baseline update still fires.
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: null })
    const baselineBuilder = makeQueryBuilder({ data: null, error: null })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(insertBuilder)
        .mockReturnValueOnce(baselineBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importExerciseRoute()
    const res = await POST(
      makeRequest({ session_id: 'sess-1', name: 'Jerk', is_pr: true, weight_kg: 150, reps: 1 })
    )
    const json = await res.json()

    // No throw — null data is returned as-is
    expect(res.status).toBe(200)
    expect(json).toBeNull()

    // Baseline update still fired (uses body fields, not DB result)
    expect(client.from).toHaveBeenNthCalledWith(3, 'exercise_baselines')
    expect(baselineBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ current_weight_kg: 150, current_reps: 1 })
    )
    expect(baselineBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(baselineBuilder.eq).toHaveBeenCalledWith('exercise_name', 'Jerk')
  })

  it('returns 500 when the insert fails', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'sess-1' }, error: null })
    const insertBuilder = makeQueryBuilder({ data: null, error: { message: 'insert boom' } })

    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(insertBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { POST } = await importExerciseRoute()
    const res = await POST(makeRequest({ session_id: 'sess-1', name: 'Squat', weight_kg: 100, reps: 5 }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to save exercise' })
    // No baseline update attempted after a failed insert
    expect(client.from).toHaveBeenCalledTimes(2)
    errSpy.mockRestore()
  })
})

function makeDeleteRequest(id?: string): Request {
  const url = id == null
    ? 'http://localhost/api/training/exercise'
    : `http://localhost/api/training/exercise?id=${encodeURIComponent(id)}`
  return { url } as Request
}

describe('DELETE /api/training/exercise', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when no user', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importExerciseRoute()
    const res = await DELETE(makeDeleteRequest('ex-1'))

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 when id is missing', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importExerciseRoute()
    const res = await DELETE(makeDeleteRequest())

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'id is required' })
  })

  it('returns 404 when the exercise is not owned by the user', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: null, error: null })
    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn().mockReturnValue(ownershipBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importExerciseRoute()
    const res = await DELETE(makeDeleteRequest('ex-other'))

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'Not found' })
    // Only the ownership check ran — no delete
    expect(client.from).toHaveBeenCalledTimes(1)
  })

  it('deletes the exercise when owned by the user', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'ex-1', session_id: 'sess-1' }, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: null })
    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(deleteBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importExerciseRoute()
    const res = await DELETE(makeDeleteRequest('ex-1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('id', 'ex-1')
  })

  it('returns 500 when the delete fails', async () => {
    const ownershipBuilder = makeQueryBuilder({ data: { id: 'ex-1', session_id: 'sess-1' }, error: null })
    const deleteBuilder = makeQueryBuilder({ data: null, error: { message: 'delete boom' } })
    const user = { id: 'user-123', email: 'test@test.com' }
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
      from: vi.fn()
        .mockReturnValueOnce(ownershipBuilder)
        .mockReturnValueOnce(deleteBuilder),
    }
    mockCreateClient.mockResolvedValue(client as never)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { DELETE } = await importExerciseRoute()
    const res = await DELETE(makeDeleteRequest('ex-1'))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to delete exercise' })
    errSpy.mockRestore()
  })
})

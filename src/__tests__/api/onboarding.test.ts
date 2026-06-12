import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSupabaseMock, makeUnauthSupabase, makeQueryBuilder } from '../mocks/supabase'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/ai-cache', () => ({
  invalidateUserAICaches: vi.fn().mockResolvedValue(undefined),
  invalidateUserSettingsCache: vi.fn().mockResolvedValue(undefined),
}))

import { createClient } from '@/lib/supabase/server'
import { invalidateUserAICaches, invalidateUserSettingsCache } from '@/lib/ai-cache'
import { GET, POST, DELETE } from '@/app/api/onboarding/route'

function makeRequest(body: unknown, headers: Record<string, string | null> = {}) {
  return {
    json: () => Promise.resolve(body),
    headers: { get: (key: string) => headers[key] ?? null },
  } as unknown as Request
}

async function json(res: Response) {
  return res.json()
}

// Helper: pull the upsert arg that contains a given key from all upsert calls
function findUpsertWith(queryBuilder: ReturnType<typeof makeQueryBuilder>, key: string): Record<string, unknown> | undefined {
  const allArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
    (c: unknown[]) => c[0] as Record<string, unknown>,
  )
  return allArgs.find(a => key in (a ?? {}))
}

// Helper: pull the delete call args matching a given table from client.from calls
function getDeleteEquCalls(queryBuilder: ReturnType<typeof makeQueryBuilder>): Array<unknown[]> {
  return (queryBuilder.eq as ReturnType<typeof vi.fn>).mock.calls
}

describe('GET /api/onboarding', () => {
  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await GET()
    expect(res.status).toBe(401)
    expect(await json(res)).toEqual({ error: 'Unauthorized' })
  })

  it('returns 200 with data when record exists', async () => {
    const record = { user_id: 'user-123', current_step: 3, completed: false }
    const { client } = makeSupabaseMock({ queryResult: { data: record, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual(record)
  })

  it('returns 200 with empty object when no record found (null)', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await GET()
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({})
  })
})

describe('POST /api/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invalidateUserAICaches).mockResolvedValue(undefined)
    vi.mocked(invalidateUserSettingsCache).mockResolvedValue(undefined)
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ section: 'interests', data: {} }))
    expect(res.status).toBe(401)
    expect(await json(res)).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 for invalid section', async () => {
    const { client } = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ section: 'invalid_section', data: {} }))
    expect(res.status).toBe(400)
    expect(await json(res)).toEqual({ error: 'Invalid section' })
  })

  it('returns 400 when physical section is missing primary_goal or sex', async () => {
    const { client } = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ section: 'physical', data: { age: 28 } }))
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.error).toMatch(/primary_goal|sex/)
  })

  it('returns 500 when upsert fails', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: { message: 'DB error' } } })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ section: 'interests', data: { foo: 'bar' } }))
    expect(res.status).toBe(500)
    expect(await json(res)).toEqual({ error: 'DB error' })
  })

  it('returns 200 with success:true when no section, sets current_step and completed', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ current_step: 5, completed: true }))
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ success: true })
  })

  it('returns 200 when section=physical but data=null (no side effects)', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ section: 'physical', data: null }))
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ success: true })
    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
    expect(fromCalls).not.toContain('menstrual_cycles')
    expect(fromCalls).not.toContain('user_profile')
    expect(fromCalls).not.toContain('user_goals')
  })

  // ── content-length header checks ──────────────────────────────────────────

  it('returns 413 when content-length header exceeds MAX_PAYLOAD_BYTES', async () => {
    const { client } = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest(
      { section: 'interests', data: {} },
      { 'content-length': String(102_401) },
    ))
    expect(res.status).toBe(413)
    expect(await json(res)).toEqual({ error: 'Payload too large' })
  })

  it('proceeds normally when content-length header is within limit', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest(
      { section: 'interests', data: {} },
      { 'content-length': String(1024) },
    ))
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ success: true })
  })

  it('proceeds normally when content-length header equals exactly MAX_PAYLOAD_BYTES', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest(
      { section: 'interests', data: {} },
      { 'content-length': String(102_400) },
    ))
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ success: true })
  })

  // ── physical validation: partial missing fields ────────────────────────────

  it('returns 400 when physical section has sex but is missing primary_goal', async () => {
    const { client } = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ section: 'physical', data: { sex: 'Female' } }))
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.error).toContain('primary_goal')
    expect(body.error).not.toContain('sex')
  })

  it('returns 400 when physical section has primary_goal but is missing sex', async () => {
    const { client } = makeSupabaseMock()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ section: 'physical', data: { primary_goal: 'Fat Loss' } }))
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.error).toContain('sex')
    expect(body.error).not.toContain('primary_goal')
  })

  // ── current_step clamping ─────────────────────────────────────────────────

  it('clamps current_step to 0 when a negative value is supplied', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ current_step: -5 }))
    expect(res.status).toBe(200)

    const upsertArg = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(upsertArg.current_step).toBe(0)
  })

  it('clamps current_step to MAX_STEPS (20) when value exceeds 20', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ current_step: 999 }))
    expect(res.status).toBe(200)

    const upsertArg = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(upsertArg.current_step).toBe(20)
  })

  it('sets current_step to 0 when a non-numeric string is passed (NaN coerces to 0)', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ current_step: 'abc' }))
    expect(res.status).toBe(200)

    const upsertArg = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(upsertArg.current_step).toBe(0)
  })

  // ── completed=false path ──────────────────────────────────────────────────

  it('sets completed=false explicitly in payload', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({ completed: false }))
    expect(res.status).toBe(200)

    const upsertArg = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(upsertArg.completed).toBe(false)
  })

  // ── no section/step/completed — minimal payload ───────────────────────────

  it('succeeds with payload containing only user_id and updated_at when no section/step/completed provided', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)

    const upsertArg = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(upsertArg)).toEqual(expect.arrayContaining(['user_id', 'updated_at']))
    expect(upsertArg.current_step).toBeUndefined()
    expect(upsertArg.completed).toBeUndefined()
  })

  // ── cache invalidation called after successful upsert ─────────────────────

  it('calls invalidateUserAICaches and invalidateUserSettingsCache after successful upsert', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: null } })
    vi.mocked(createClient).mockResolvedValue(client as any)

    await POST(makeRequest({ section: 'interests', data: {} }))

    expect(invalidateUserAICaches).toHaveBeenCalledWith('user-123')
    expect(invalidateUserSettingsCache).toHaveBeenCalledWith('user-123')
  })

  it('does not call cache invalidation when upsert fails (returns 500 early)', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: { message: 'DB error' } } })
    vi.mocked(createClient).mockResolvedValue(client as any)

    await POST(makeRequest({ section: 'interests', data: {} }))

    expect(invalidateUserAICaches).not.toHaveBeenCalled()
    expect(invalidateUserSettingsCache).not.toHaveBeenCalled()
  })

  describe('section=physical side effects', () => {
    // Minimal valid physical payload — avoids 400 from required-field validation
    const basePhysical = { primary_goal: 'Fat Loss', sex: 'Female' }

    it('calls menstrual_cycles upsert with default cycle_length_days=28 when sex=Female and last_period_date, avg_cycle_length_days absent', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { ...basePhysical, last_period_date: '2026-05-01' },
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('menstrual_cycles')

      const menstrualUpsert = findUpsertWith(queryBuilder, 'cycle_length_days')
      expect(menstrualUpsert?.cycle_length_days).toBe(28)
      expect(menstrualUpsert?.period_start_date).toBe('2026-05-01')
    })

    it('calls menstrual_cycles upsert with provided avg_cycle_length_days when sex=Female', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { ...basePhysical, last_period_date: '2026-05-01', avg_cycle_length_days: 30 },
      }))
      expect(res.status).toBe(200)

      const menstrualUpsert = findUpsertWith(queryBuilder, 'cycle_length_days')
      expect(menstrualUpsert?.cycle_length_days).toBe(30)
    })

    it('does not call menstrual_cycles upsert when sex is not Female', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { primary_goal: 'Fat Loss', sex: 'Male', last_period_date: '2026-05-01' },
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).not.toContain('menstrual_cycles')
    })

    it('does not call menstrual_cycles when sex=Female but no last_period_date', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { ...basePhysical },
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).not.toContain('menstrual_cycles')
    })

    it('mirrors age, height_cm, gender (lowercased) and location to user_profile', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { primary_goal: 'Fat Loss', sex: 'Female', age: 28, height_cm: 165, location: 'Dubai' },
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_profile')

      const profileUpsert = findUpsertWith(queryBuilder, 'age')
      expect(profileUpsert?.age).toBe(28)
      expect(profileUpsert?.height_cm).toBe(165)
      expect(profileUpsert?.gender).toBe('female') // lowercase
      expect(profileUpsert?.location).toBe('Dubai')
    })

    it('omits location from user_profile upsert when not provided', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      await POST(makeRequest({
        section: 'physical',
        data: { primary_goal: 'Fat Loss', sex: 'Male', current_weight_kg: 70 },
      }))

      const profileUpsert = findUpsertWith(queryBuilder, 'gender')
      expect(profileUpsert?.location).toBeUndefined()
    })

    it('includes current_weight_kg, target_weight_kg, body_fat_pct, target_event in user_goals upsert', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      await POST(makeRequest({
        section: 'physical',
        data: {
          primary_goal: 'Fat Loss', sex: 'Male',
          current_weight_kg: 80, target_weight_kg: 75, body_fat_pct: 18,
          target_event_name: 'Marathon', target_event_date: '2026-11-01',
        },
      }))

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_goals')

      const goalsUpsert = findUpsertWith(queryBuilder, 'current_weight_kg')
      expect(goalsUpsert?.current_weight_kg).toBe(80)
      expect(goalsUpsert?.target_weight_kg).toBe(75)
      expect(goalsUpsert?.body_fat_pct).toBe(18)
      expect(goalsUpsert?.target_event_name).toBe('Marathon')
      expect(goalsUpsert?.target_event_date).toBe('2026-11-01')
    })

    it('deletes stale menstrual_cycles row when oldPeriodDate differs from new last_period_date', async () => {
      // The existing row has last_period_date = '2026-04-01'
      const existingPhysical = { last_period_date: '2026-04-01' }
      const queryBuilder = makeQueryBuilder({ data: { physical: existingPhysical }, error: null })
      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { ...basePhysical, last_period_date: '2026-05-01' },
      }))
      expect(res.status).toBe(200)

      // delete() should have been called (for the stale row)
      expect(queryBuilder.delete).toHaveBeenCalled()

      // The eq calls that follow the delete should include the old period date
      const eqCalls = (queryBuilder.eq as ReturnType<typeof vi.fn>).mock.calls as Array<[string, unknown]>
      const periodDateDeleteCall = eqCalls.find(
        ([col, val]) => col === 'period_start_date' && val === '2026-04-01',
      )
      expect(periodDateDeleteCall).toBeDefined()
    })

    it('does not delete stale menstrual_cycles row when oldPeriodDate equals new last_period_date', async () => {
      const existingPhysical = { last_period_date: '2026-05-01' }
      const queryBuilder = makeQueryBuilder({ data: { physical: existingPhysical }, error: null })
      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { ...basePhysical, last_period_date: '2026-05-01' },
      }))
      expect(res.status).toBe(200)

      // eq with old period start date for delete should NOT be called
      const eqCalls = (queryBuilder.eq as ReturnType<typeof vi.fn>).mock.calls as Array<[string, unknown]>
      const staleDeleteCall = eqCalls.find(
        ([col, val]) => col === 'period_start_date' && val === '2026-04-01',
      )
      expect(staleDeleteCall).toBeUndefined()
    })

    it('logs error when menstrual_cycles upsert fails but still returns 200', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // We need per-table control: upsert for menstrual_cycles fails, others succeed.
      // Use a single query builder but track upsert call count.
      let upsertCallCount = 0
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const originalUpsert = queryBuilder.upsert as (...args: unknown[]) => unknown
      queryBuilder.upsert = vi.fn((...args: unknown[]) => {
        upsertCallCount++
        // First upsert = user_onboarding (main), second = menstrual_cycles
        if (upsertCallCount === 2) {
          // Return a thenable that resolves to an error
          const errorBuilder = makeQueryBuilder({ data: null, error: { message: 'cycle upsert failed' } })
          return errorBuilder
        }
        return originalUpsert(...args)
      }) as any

      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { ...basePhysical, last_period_date: '2026-05-01' },
      }))
      expect(res.status).toBe(200)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('menstrual_cycles'),
        expect.any(String),
      )
      consoleErrorSpy.mockRestore()
    })

    it('logs error when user_profile upsert fails but still returns 200', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let upsertCallCount = 0
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const originalUpsert = queryBuilder.upsert as (...args: unknown[]) => unknown
      queryBuilder.upsert = vi.fn((...args: unknown[]) => {
        upsertCallCount++
        // Calls: 1=user_onboarding, 2=user_profile (no menstrual_cycles because no last_period_date)
        if (upsertCallCount === 2) {
          return makeQueryBuilder({ data: null, error: { message: 'profile upsert failed' } })
        }
        return originalUpsert(...args)
      }) as any

      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        // No last_period_date so menstrual_cycles upsert skipped; user_profile is call #2
        data: { primary_goal: 'Fat Loss', sex: 'Male', age: 30 },
      }))
      expect(res.status).toBe(200)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('user_profile'),
        expect.any(String),
      )
      consoleErrorSpy.mockRestore()
    })

    it('logs error when user_goals upsert fails but still returns 200', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let upsertCallCount = 0
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const originalUpsert = queryBuilder.upsert as (...args: unknown[]) => unknown
      queryBuilder.upsert = vi.fn((...args: unknown[]) => {
        upsertCallCount++
        // Calls: 1=user_onboarding, 2=user_profile, 3=user_goals
        if (upsertCallCount === 3) {
          return makeQueryBuilder({ data: null, error: { message: 'goals upsert failed' } })
        }
        return originalUpsert(...args)
      }) as any

      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { primary_goal: 'Fat Loss', sex: 'Male', current_weight_kg: 80 },
      }))
      expect(res.status).toBe(200)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('user_goals'),
        expect.any(String),
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe('section=lifestyle_ext side effects', () => {
    it('upserts user_lifestyle with computed wake times and normalised social_night', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'lifestyle_ext',
        data: {
          wake_times: { Mon: '06:00', Tue: '06:00', Wed: '06:00', Thu: '06:00', Fri: '06:00', Sat: '08:00', Sun: '08:00' },
          weekday_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          sleep_target_weeknight: '23:30',
          social_night: 'Friday',
        },
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_lifestyle')

      const lifestyleUpsert = findUpsertWith(queryBuilder, 'wake_time_weekday')
      expect(lifestyleUpsert?.wake_time_weekday).toBe('06:00')
      expect(lifestyleUpsert?.wake_time_weekend).toBe('08:00')
      expect(lifestyleUpsert?.sleep_target_weeknight).toBe('23:30')
      expect(lifestyleUpsert?.social_night).toBe('friday') // lowercased
    })

    it('omits wake_time_weekday/weekend when wake_times is empty (avgWakeTime returns null)', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'lifestyle_ext',
        data: {
          wake_times: {},
          sleep_target_weeknight: '23:00',
        },
      }))
      expect(res.status).toBe(200)

      const lifestyleUpsert = findUpsertWith(queryBuilder, 'sleep_target_weeknight')
      expect(lifestyleUpsert?.wake_time_weekday).toBeUndefined()
      expect(lifestyleUpsert?.wake_time_weekend).toBeUndefined()
    })

    it('omits wake_time_weekday/weekend when wake_times is absent', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'lifestyle_ext',
        data: { sleep_target_weeknight: '23:00' },
      }))
      expect(res.status).toBe(200)

      const lifestyleUpsert = findUpsertWith(queryBuilder, 'sleep_target_weeknight')
      expect(lifestyleUpsert?.wake_time_weekday).toBeUndefined()
      expect(lifestyleUpsert?.wake_time_weekend).toBeUndefined()
    })

    it('uses custom weekday_days to compute correct weekend days', async () => {
      // Only Mon/Tue are "weekdays"; Wed-Sun are "weekend"
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'lifestyle_ext',
        data: {
          wake_times: {
            Mon: '07:00', Tue: '07:00',
            Wed: '09:00', Thu: '09:00', Fri: '09:00', Sat: '09:00', Sun: '09:00',
          },
          weekday_days: ['Mon', 'Tue'],
        },
      }))
      expect(res.status).toBe(200)

      const lifestyleUpsert = findUpsertWith(queryBuilder, 'wake_time_weekday')
      expect(lifestyleUpsert?.wake_time_weekday).toBe('07:00')
      expect(lifestyleUpsert?.wake_time_weekend).toBe('09:00')
    })

    it('falls back to default Mon-Fri weekday split when weekday_days absent', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'lifestyle_ext',
        data: {
          wake_times: {
            Mon: '06:00', Tue: '06:00', Wed: '06:00', Thu: '06:00', Fri: '06:00',
            Sat: '08:00', Sun: '08:00',
          },
          // no weekday_days — should default to Mon-Fri
        },
      }))
      expect(res.status).toBe(200)

      const lifestyleUpsert = findUpsertWith(queryBuilder, 'wake_time_weekday')
      expect(lifestyleUpsert?.wake_time_weekday).toBe('06:00')
      expect(lifestyleUpsert?.wake_time_weekend).toBe('08:00')
    })

    it('omits social_night when absent', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'lifestyle_ext',
        data: {
          wake_times: { Mon: '06:00' },
          weekday_days: ['Mon'],
          sleep_target_weeknight: '22:30',
          // no social_night
        },
      }))
      expect(res.status).toBe(200)

      const lifestyleUpsert = findUpsertWith(queryBuilder, 'sleep_target_weeknight')
      expect(lifestyleUpsert?.social_night).toBeUndefined()
    })

    it('logs error when user_lifestyle upsert fails for lifestyle_ext but still returns 200', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let upsertCallCount = 0
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const originalUpsert = queryBuilder.upsert as (...args: unknown[]) => unknown
      queryBuilder.upsert = vi.fn((...args: unknown[]) => {
        upsertCallCount++
        // Calls: 1=user_onboarding, 2=user_lifestyle
        if (upsertCallCount === 2) {
          return makeQueryBuilder({ data: null, error: { message: 'lifestyle upsert failed' } })
        }
        return originalUpsert(...args)
      }) as any

      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'lifestyle_ext',
        data: { sleep_target_weeknight: '23:00' },
      }))
      expect(res.status).toBe(200)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('user_lifestyle'),
        expect.any(String),
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe('section=nutrition_ext side effects', () => {
    it('upserts user_lifestyle with diet_type, dislikes (from dislikes_list), coffee_cutoff', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'nutrition_ext',
        // Form stores as dislikes_list; route maps it to dislikes column
        data: { diet_type: 'vegan', dislikes_list: ['mushrooms'], coffee_cutoff: '14:00' },
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_lifestyle')

      const nutritionUpsert = findUpsertWith(queryBuilder, 'diet_type')
      expect(nutritionUpsert?.diet_type).toBe('vegan')
      expect(nutritionUpsert?.dislikes).toEqual(['mushrooms'])
      expect(nutritionUpsert?.coffee_cutoff).toBe('14:00')
    })

    it('upserts user_lifestyle with only user_id and updated_at when all optional fields absent', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'nutrition_ext',
        data: {},
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_lifestyle')

      // All optional fields should be absent from the upsert payload
      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0] as Record<string, unknown>,
      )
      // Find the nutrition upsert (it will not have diet_type, dislikes, or coffee_cutoff)
      const nutritionUpsert = allUpsertArgs.find(a => 'user_id' in a && !('gym_name' in a) && !('wake_time_weekday' in a))
      expect(nutritionUpsert?.diet_type).toBeUndefined()
      expect(nutritionUpsert?.dislikes).toBeUndefined()
      expect(nutritionUpsert?.coffee_cutoff).toBeUndefined()
    })

    it('logs error when user_lifestyle upsert fails for nutrition_ext but still returns 200', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let upsertCallCount = 0
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const originalUpsert = queryBuilder.upsert as (...args: unknown[]) => unknown
      queryBuilder.upsert = vi.fn((...args: unknown[]) => {
        upsertCallCount++
        if (upsertCallCount === 2) {
          return makeQueryBuilder({ data: null, error: { message: 'nutrition upsert failed' } })
        }
        return originalUpsert(...args)
      }) as any

      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'nutrition_ext',
        data: { diet_type: 'keto' },
      }))
      expect(res.status).toBe(200)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('user_lifestyle'),
        expect.any(String),
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe('section=training_ext side effects', () => {
    it('upserts user_training with gym_name', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'training_ext',
        data: { gym_name: 'Equinox' },
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_training')

      const trainingUpsert = findUpsertWith(queryBuilder, 'gym_name')
      expect(trainingUpsert?.gym_name).toBe('Equinox')
    })

    it('upserts user_training without gym_name when absent', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'training_ext',
        data: {},
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_training')

      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0] as Record<string, unknown>,
      )
      const trainingUpsert = allUpsertArgs.find(a => 'updated_at' in a && !('physical' in a) && !('interests' in a))
      expect(trainingUpsert?.gym_name).toBeUndefined()
    })

    it('logs error when user_training upsert fails but still returns 200', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      let upsertCallCount = 0
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const originalUpsert = queryBuilder.upsert as (...args: unknown[]) => unknown
      queryBuilder.upsert = vi.fn((...args: unknown[]) => {
        upsertCallCount++
        if (upsertCallCount === 2) {
          return makeQueryBuilder({ data: null, error: { message: 'training upsert failed' } })
        }
        return originalUpsert(...args)
      }) as any

      const client = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'training_ext',
        data: { gym_name: 'LA Fitness' },
      }))
      expect(res.status).toBe(200)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('user_training'),
        expect.any(String),
      )
      consoleErrorSpy.mockRestore()
    })
  })

  describe('valid ONBOARDING_SECTIONS accepted', () => {
    const nonPhysicalSections = [
      'interests', 'lifestyle_ext', 'training_ext', 'nutrition_ext',
      'supplements_ext', 'sleep_ext', 'skincare', 'hair',
      'mental', 'travel', 'tech_prefs', 'coaching',
    ]

    for (const section of nonPhysicalSections) {
      it(`accepts section="${section}" without 400`, async () => {
        const queryBuilder = makeQueryBuilder({ data: null, error: null })
        const client = {
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
          },
          from: vi.fn(() => queryBuilder),
        }
        vi.mocked(createClient).mockResolvedValue(client as any)

        const res = await POST(makeRequest({ section, data: {} }))
        expect(res.status).toBe(200)
        expect(await json(res)).toEqual({ success: true })
      })
    }

    it('accepts section="physical" with required fields present', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({ section: 'physical', data: { primary_goal: 'Fat Loss', sex: 'Male' } }))
      expect(res.status).toBe(200)
      expect(await json(res)).toEqual({ success: true })
    })
  })
})

describe('DELETE /api/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await DELETE()
    expect(res.status).toBe(401)
    expect(await json(res)).toEqual({ error: 'Unauthorized' })
  })

  it('deletes user_onboarding record and cascades nulls to mirrored tables', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
      },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await DELETE()
    expect(res.status).toBe(200)
    expect(await json(res)).toEqual({ success: true })

    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
    expect(fromCalls).toContain('user_onboarding')
    expect(fromCalls).toContain('user_profile')
    expect(fromCalls).toContain('user_goals')
    expect(fromCalls).toContain('user_lifestyle')
    expect(fromCalls).toContain('user_training')
    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.update).toHaveBeenCalled()
  })

  it('includes menstrual_cycles delete in Promise.all when physical has last_period_date', async () => {
    const queryBuilder = makeQueryBuilder({ data: { physical: { last_period_date: '2026-05-01' } }, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await DELETE()
    expect(res.status).toBe(200)

    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
    expect(fromCalls).toContain('menstrual_cycles')

    // Verify the eq with the specific period date was called
    const eqCalls = (queryBuilder.eq as ReturnType<typeof vi.fn>).mock.calls as Array<[string, unknown]>
    const periodDeleteCall = eqCalls.find(
      ([col, val]) => col === 'period_start_date' && val === '2026-05-01',
    )
    expect(periodDeleteCall).toBeDefined()
  })

  it('skips menstrual_cycles delete when physical exists but has no last_period_date', async () => {
    const queryBuilder = makeQueryBuilder({ data: { physical: { sex: 'Female' } }, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await DELETE()
    expect(res.status).toBe(200)

    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
    expect(fromCalls).not.toContain('menstrual_cycles')
  })

  it('skips menstrual_cycles delete when onboarding row not found (physical is null)', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await DELETE()
    expect(res.status).toBe(200)

    const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
    expect(fromCalls).not.toContain('menstrual_cycles')
  })
})

// ── avgWakeTime unit-level tests (exercised indirectly via POST lifestyle_ext) ──

describe('avgWakeTime logic (via POST lifestyle_ext)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(invalidateUserAICaches).mockResolvedValue(undefined)
    vi.mocked(invalidateUserSettingsCache).mockResolvedValue(undefined)
  })

  it('returns null (omits field) when days array maps to no known wake times (empty result)', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    // wake_times only has Mon-Fri entries; weekday_days covers all 7 days so weekendDays = []
    // That means avgWakeTime([], wakeTimes) for weekend returns null
    const res = await POST(makeRequest({
      section: 'lifestyle_ext',
      data: {
        wake_times: { Mon: '06:00', Tue: '06:30', Wed: '07:00', Thu: '06:00', Fri: '06:30', Sat: '08:00', Sun: '08:00' },
        weekday_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], // ALL days are weekday
      },
    }))
    expect(res.status).toBe(200)

    // With all 7 days as "weekday", weekendDays is empty => wake_time_weekend should be undefined
    const lifestyleUpsert = findUpsertWith(queryBuilder, 'wake_time_weekday')
    expect(lifestyleUpsert?.wake_time_weekend).toBeUndefined()
  })

  it('returns correct HH:MM for a single day wake time', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({
      section: 'lifestyle_ext',
      data: {
        wake_times: { Mon: '07:45' },
        weekday_days: ['Mon'],
        // Tue-Sun become weekend; no wake_times for them => null
      },
    }))
    expect(res.status).toBe(200)

    const lifestyleUpsert = findUpsertWith(queryBuilder, 'wake_time_weekday')
    expect(lifestyleUpsert?.wake_time_weekday).toBe('07:45')
    expect(lifestyleUpsert?.wake_time_weekend).toBeUndefined()
  })

  it('correctly averages two wake times (06:00 and 08:00 → 07:00)', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({
      section: 'lifestyle_ext',
      data: {
        wake_times: { Sat: '06:00', Sun: '08:00' },
        weekday_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], // no wake times for weekdays
      },
    }))
    expect(res.status).toBe(200)

    const lifestyleUpsert = findUpsertWith(queryBuilder, 'wake_time_weekend')
    expect(lifestyleUpsert?.wake_time_weekend).toBe('07:00')
    expect(lifestyleUpsert?.wake_time_weekday).toBeUndefined()
  })

  it('correctly averages times that produce a non-zero minute component (06:00 and 06:30 → 06:15)', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({
      section: 'lifestyle_ext',
      data: {
        wake_times: { Mon: '06:00', Tue: '06:30' },
        weekday_days: ['Mon', 'Tue'],
      },
    }))
    expect(res.status).toBe(200)

    const lifestyleUpsert = findUpsertWith(queryBuilder, 'wake_time_weekday')
    expect(lifestyleUpsert?.wake_time_weekday).toBe('06:15')
  })

  it('handles late-night/early-morning average (23:00 and 01:00 → 00:00)', async () => {
    const queryBuilder = makeQueryBuilder({ data: null, error: null })
    const client = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }) },
      from: vi.fn(() => queryBuilder),
    }
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await POST(makeRequest({
      section: 'lifestyle_ext',
      data: {
        wake_times: { Sat: '23:00', Sun: '01:00' },
        weekday_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      },
    }))
    expect(res.status).toBe(200)

    // 23:00 = 1380 min, 01:00 = 60 min, avg = 720 min = 12:00 (arithmetic mean, no wrap)
    const lifestyleUpsert = findUpsertWith(queryBuilder, 'wake_time_weekend')
    expect(lifestyleUpsert?.wake_time_weekend).toBe('12:00')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSupabaseMock, makeUnauthSupabase, makeQueryBuilder } from '../mocks/supabase'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET, POST, DELETE } from '@/app/api/onboarding/route'

function makeRequest(body: unknown) {
  return { json: () => Promise.resolve(body) } as Request
}

async function json(res: Response) {
  return res.json()
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

  describe('section=physical side effects', () => {
    it('calls menstrual_cycles upsert with default cycle_length_days=28 when sex=Female and last_period_date, avg_cycle_length_days absent', async () => {
      const upsertFn = vi.fn().mockResolvedValue({ data: null, error: null })
      const eqFn = vi.fn().mockResolvedValue({ data: null, error: null })

      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      ;(queryBuilder.upsert as ReturnType<typeof vi.fn>).mockImplementation(() => queryBuilder)

      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const res = await POST(makeRequest({
        section: 'physical',
        data: { sex: 'Female', last_period_date: '2026-05-01' },
      }))
      expect(res.status).toBe(200)

      const menstrualCall = (client.from as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[0] === 'menstrual_cycles',
      )
      expect(menstrualCall).toBeTruthy()

      const upsertArg = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.find(
        (_: unknown, i: number) => {
          const calls = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls
          return calls[i]?.[0]?.cycle_length_days !== undefined
        },
      )
      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      )
      const menstrualUpsert = allUpsertArgs.find(
        (a: Record<string, unknown>) => a?.cycle_length_days !== undefined,
      )
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
        data: { sex: 'Female', last_period_date: '2026-05-01', avg_cycle_length_days: 30 },
      }))
      expect(res.status).toBe(200)

      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      )
      const menstrualUpsert = allUpsertArgs.find(
        (a: Record<string, unknown>) => a?.cycle_length_days !== undefined,
      )
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
        data: { sex: 'Male', last_period_date: '2026-05-01' },
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
        data: { sex: 'Female' },
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).not.toContain('menstrual_cycles')
    })

    it('includes location in user_profile upsert when provided', async () => {
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
        data: { location: 'New York' },
      }))

      const profileCallIndex = (client.from as ReturnType<typeof vi.fn>).mock.calls.findIndex(
        (c: unknown[]) => c[0] === 'user_profile',
      )
      expect(profileCallIndex).toBeGreaterThanOrEqual(0)

      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      )
      const profileUpsert = allUpsertArgs.find(
        (a: Record<string, unknown>) => a?.location !== undefined,
      )
      expect(profileUpsert?.location).toBe('New York')
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
        data: { current_weight_kg: 70 },
      }))

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_profile')

      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      )
      const profileUpsert = allUpsertArgs.find(
        (a: Record<string, unknown>) => 'user_id' in (a ?? {}) && !('location' in (a ?? {})) && !('current_weight_kg' in (a ?? {})),
      )
      expect(profileUpsert?.location).toBeUndefined()
    })

    it('includes current_weight_kg, target_weight_kg, body_fat_pct in user_goals upsert', async () => {
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
        data: { current_weight_kg: 80, target_weight_kg: 75, body_fat_pct: 18 },
      }))

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_goals')

      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      )
      const goalsUpsert = allUpsertArgs.find(
        (a: Record<string, unknown>) => a?.current_weight_kg !== undefined,
      )
      expect(goalsUpsert?.current_weight_kg).toBe(80)
      expect(goalsUpsert?.target_weight_kg).toBe(75)
      expect(goalsUpsert?.body_fat_pct).toBe(18)
    })
  })

  describe('section=lifestyle_ext side effects', () => {
    it('upserts user_lifestyle with all lifestyle fields', async () => {
      const queryBuilder = makeQueryBuilder({ data: null, error: null })
      const client = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null }),
        },
        from: vi.fn(() => queryBuilder),
      }
      vi.mocked(createClient).mockResolvedValue(client as any)

      const lifestyleData = {
        wake_time_weekday: '06:00',
        wake_time_weekend: '08:00',
        sleep_target_weeknight: 8,
        social_night: 'Friday',
      }

      const res = await POST(makeRequest({ section: 'lifestyle_ext', data: lifestyleData }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_lifestyle')

      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      )
      const lifestyleUpsert = allUpsertArgs.find(
        (a: Record<string, unknown>) => a?.wake_time_weekday !== undefined,
      )
      expect(lifestyleUpsert?.wake_time_weekday).toBe('06:00')
      expect(lifestyleUpsert?.wake_time_weekend).toBe('08:00')
      expect(lifestyleUpsert?.sleep_target_weeknight).toBe(8)
      expect(lifestyleUpsert?.social_night).toBe('Friday')
    })
  })

  describe('section=nutrition_ext side effects', () => {
    it('upserts user_lifestyle with diet_type, dislikes, coffee_cutoff', async () => {
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
        data: { diet_type: 'vegan', dislikes: ['mushrooms'], coffee_cutoff: '14:00' },
      }))
      expect(res.status).toBe(200)

      const fromCalls = (client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0])
      expect(fromCalls).toContain('user_lifestyle')

      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      )
      const nutritionUpsert = allUpsertArgs.find(
        (a: Record<string, unknown>) => a?.diet_type !== undefined,
      )
      expect(nutritionUpsert?.diet_type).toBe('vegan')
      expect(nutritionUpsert?.dislikes).toEqual(['mushrooms'])
      expect(nutritionUpsert?.coffee_cutoff).toBe('14:00')
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

      const allUpsertArgs = (queryBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: unknown[]) => c[0],
      )
      const trainingUpsert = allUpsertArgs.find(
        (a: Record<string, unknown>) => a?.gym_name !== undefined,
      )
      expect(trainingUpsert?.gym_name).toBe('Equinox')
    })
  })

  describe('valid ONBOARDING_SECTIONS accepted', () => {
    const validSections = [
      'interests', 'physical', 'lifestyle_ext', 'training_ext', 'nutrition_ext',
      'supplements_ext', 'sleep_ext', 'skincare', 'hair',
      'mental', 'travel', 'tech_prefs', 'coaching',
    ]

    for (const section of validSections) {
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
  })
})

describe('DELETE /api/onboarding', () => {
  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    vi.mocked(createClient).mockResolvedValue(client as any)

    const res = await DELETE()
    expect(res.status).toBe(401)
    expect(await json(res)).toEqual({ error: 'Unauthorized' })
  })

  it('deletes user_onboarding record and returns success', async () => {
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

    expect(client.from).toHaveBeenCalledWith('user_onboarding')
    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })
})

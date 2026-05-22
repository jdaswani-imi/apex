import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSupabaseMock, makeUnauthSupabase, makeQueryBuilder } from '../mocks/supabase'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { createClient } from '@/lib/supabase/server'
import { GET, POST, DELETE } from '@/app/api/onboarding/route'

function makeRequest(body: unknown) {
  return { json: () => Promise.resolve(body), headers: { get: () => null } } as unknown as Request
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
})

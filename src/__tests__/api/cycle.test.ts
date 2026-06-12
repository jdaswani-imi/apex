import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSupabaseMock, makeUnauthSupabase } from '../mocks/supabase'
import { createClient } from '@/lib/supabase/server'
import { getRecentMenstrualCycles, upsertMenstrualCycle, deleteMenstrualCycle } from '@/lib/db'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/db', () => ({
  getRecentMenstrualCycles: vi.fn(),
  upsertMenstrualCycle: vi.fn(),
  deleteMenstrualCycle: vi.fn(),
}))

const mockCreateClient = vi.mocked(createClient)
const mockGetRecentMenstrualCycles = vi.mocked(getRecentMenstrualCycles)
const mockUpsertMenstrualCycle = vi.mocked(upsertMenstrualCycle)
const mockDeleteMenstrualCycle = vi.mocked(deleteMenstrualCycle)

function makeJsonRequest(body: unknown, urlOverride?: string): Request {
  return {
    json: () => Promise.resolve(body),
    url: urlOverride ?? 'https://example.com/api/cycle',
  } as unknown as Request
}

function makeDeleteRequest(id?: string): Request {
  const url = id
    ? `https://example.com/api/cycle?id=${id}`
    : 'https://example.com/api/cycle'
  return { url } as Request
}

async function importRoute() {
  return import('@/app/api/cycle/route')
}

// ---------------------------------------------------------------------------
// GET /api/cycle
// ---------------------------------------------------------------------------
describe('GET /api/cycle', () => {
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

  it('returns recent cycles when authenticated', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const fakeCycles = [
      { id: '1', period_start_date: '2024-01-01', cycle_length_days: 28 },
      { id: '2', period_start_date: '2024-02-01', cycle_length_days: 29 },
    ]
    mockGetRecentMenstrualCycles.mockResolvedValue(fakeCycles as never)

    const { GET } = await importRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(fakeCycles)
    expect(mockGetRecentMenstrualCycles).toHaveBeenCalledWith(12)
  })

  it('returns empty array when no cycles exist', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)
    mockGetRecentMenstrualCycles.mockResolvedValue([] as never)

    const { GET } = await importRoute()
    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual([])
  })

  it('sets Cache-Control header to private, max-age=300', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)
    mockGetRecentMenstrualCycles.mockResolvedValue([] as never)

    const { GET } = await importRoute()
    const res = await GET()

    expect(res.headers.get('Cache-Control')).toBe('private, max-age=300')
  })

  it('propagates rejection when getRecentMenstrualCycles throws', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)
    mockGetRecentMenstrualCycles.mockRejectedValue(new Error('db failure'))

    const { GET } = await importRoute()
    await expect(GET()).rejects.toThrow('db failure')
  })
})

// ---------------------------------------------------------------------------
// POST /api/cycle
// ---------------------------------------------------------------------------
describe('POST /api/cycle', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makeJsonRequest({ period_start_date: '2024-01-01' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 when period_start_date is missing', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const req = makeJsonRequest({ period_end_date: '2024-01-05' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'period_start_date is required' })
  })

  it('creates a cycle with all fields provided', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const fakeCycle = {
      id: 'cycle-1',
      period_start_date: '2024-01-01',
      period_end_date: '2024-01-05',
      cycle_length_days: 30,
      notes: 'Feeling good',
    }
    mockUpsertMenstrualCycle.mockResolvedValue(fakeCycle as never)

    const { POST } = await importRoute()
    const req = makeJsonRequest({
      period_start_date: '2024-01-01',
      period_end_date: '2024-01-05',
      cycle_length_days: 30,
      notes: 'Feeling good',
    })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(fakeCycle)
    expect(mockUpsertMenstrualCycle).toHaveBeenCalledWith({
      period_start_date: '2024-01-01',
      period_end_date: '2024-01-05',
      cycle_length_days: 30,
      notes: 'Feeling good',
    })
  })

  it('applies defaults: period_end_date=null, cycle_length_days=28, notes=null', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const fakeCycle = { id: 'cycle-2', period_start_date: '2024-02-01' }
    mockUpsertMenstrualCycle.mockResolvedValue(fakeCycle as never)

    const { POST } = await importRoute()
    const req = makeJsonRequest({ period_start_date: '2024-02-01' })
    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(fakeCycle)
    expect(mockUpsertMenstrualCycle).toHaveBeenCalledWith({
      period_start_date: '2024-02-01',
      period_end_date: null,
      cycle_length_days: 28,
      notes: null,
    })
  })

  it('treats falsy period_end_date as null', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)
    mockUpsertMenstrualCycle.mockResolvedValue({ id: 'cycle-3' } as never)

    const { POST } = await importRoute()
    const req = makeJsonRequest({
      period_start_date: '2024-03-01',
      period_end_date: undefined,
      cycle_length_days: undefined,
      notes: undefined,
    })
    await POST(req)

    expect(mockUpsertMenstrualCycle).toHaveBeenCalledWith(
      expect.objectContaining({ period_end_date: null, cycle_length_days: 28, notes: null }),
    )
  })

  it('propagates rejection when upsertMenstrualCycle throws', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)
    mockUpsertMenstrualCycle.mockRejectedValue(new Error('upsert failed'))

    const { POST } = await importRoute()
    const req = makeJsonRequest({ period_start_date: '2024-01-01' })
    await expect(POST(req)).rejects.toThrow('upsert failed')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/cycle
// ---------------------------------------------------------------------------
describe('DELETE /api/cycle', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest('some-id'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 when id query param is missing', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest()) // no id
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'id required' })
  })

  it('deletes cycle by id and returns ok: true', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)
    mockDeleteMenstrualCycle.mockResolvedValue(undefined as never)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest('cycle-abc'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ ok: true })
    expect(mockDeleteMenstrualCycle).toHaveBeenCalledWith('cycle-abc')
  })

  it('calls deleteMenstrualCycle with the correct id from query string', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)
    mockDeleteMenstrualCycle.mockResolvedValue(undefined as never)

    const { DELETE } = await importRoute()
    await DELETE(makeDeleteRequest('specific-cycle-id-999'))

    expect(mockDeleteMenstrualCycle).toHaveBeenCalledOnce()
    expect(mockDeleteMenstrualCycle).toHaveBeenCalledWith('specific-cycle-id-999')
  })

  it('propagates rejection when deleteMenstrualCycle throws', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)
    mockDeleteMenstrualCycle.mockRejectedValue(new Error('delete failed'))

    const { DELETE } = await importRoute()
    await expect(DELETE(makeDeleteRequest('cycle-xyz'))).rejects.toThrow('delete failed')
  })
})

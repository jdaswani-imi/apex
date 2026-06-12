import { describe, it, expect, vi, beforeEach } from 'vitest'
import { makeSupabaseMock, makeUnauthSupabase } from '../mocks/supabase'
import { createClient } from '@/lib/supabase/server'
import { invalidateUserSettingsCache } from '@/lib/ai-cache'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ai-cache', () => ({ invalidateUserSettingsCache: vi.fn().mockResolvedValue(undefined) }))

const mockCreateClient = vi.mocked(createClient)
const mockInvalidateUserSettingsCache = vi.mocked(invalidateUserSettingsCache)

function makePostRequest(body: unknown): Request {
  return { json: () => Promise.resolve(body) } as Request
}

function makeDeleteRequest(id?: string | null): Request {
  let url: string
  if (id === null) {
    url = 'http://localhost/api/settings/supplement?id='
  } else if (id !== undefined) {
    url = `http://localhost/api/settings/supplement?id=${id}`
  } else {
    url = 'http://localhost/api/settings/supplement'
  }
  return new Request(url, { method: 'DELETE' })
}

async function importRoute() {
  const mod = await import('@/app/api/settings/supplement/route')
  return mod
}

describe('POST /api/settings/supplement', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ name: 'Creatine' }))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('calls update when id is present', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ id: 'supp-7', name: 'Creatine', dose: '5g' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(client.from).toHaveBeenCalledWith('user_supplements')
    expect(queryBuilder.update).toHaveBeenCalledWith({ name: 'Creatine', dose: '5g' })
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'supp-7')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('calls insert when id is absent', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ name: 'Magnesium', dose: '400mg' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(client.from).toHaveBeenCalledWith('user_supplements')
    expect(queryBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-123',
      name: 'Magnesium',
      dose: '400mg',
    })
  })

  it('returns { success: true } on success', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ name: 'Vitamin D' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('calls invalidateUserSettingsCache with user id after update', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    await POST(makePostRequest({ id: 'supp-7', name: 'Creatine' }))

    expect(mockInvalidateUserSettingsCache).toHaveBeenCalledTimes(1)
    expect(mockInvalidateUserSettingsCache).toHaveBeenCalledWith('user-123')
  })

  it('calls invalidateUserSettingsCache with user id after insert', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    await POST(makePostRequest({ name: 'Zinc', dose: '15mg' }))

    expect(mockInvalidateUserSettingsCache).toHaveBeenCalledTimes(1)
    expect(mockInvalidateUserSettingsCache).toHaveBeenCalledWith('user-123')
  })

  it('does not call invalidateUserSettingsCache when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    await POST(makePostRequest({ name: 'Creatine' }))

    expect(mockInvalidateUserSettingsCache).not.toHaveBeenCalled()
  })

  it('takes insert path when id is empty string', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ id: '', name: 'Fish Oil', dose: '1000mg' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(queryBuilder.insert).toHaveBeenCalledWith({
      user_id: 'user-123',
      name: 'Fish Oil',
      dose: '1000mg',
    })
    expect(queryBuilder.update).not.toHaveBeenCalled()
  })

  it('calls update with empty object when body only contains id', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ id: 'supp-7' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(queryBuilder.update).toHaveBeenCalledWith({})
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'supp-7')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('returns { success: true } even when supabase update returns a database error (silent failure)', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: { message: 'DB error' } } })
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ id: 'supp-7', name: 'Creatine' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
  })

  it('returns { success: true } even when supabase insert returns a database error (silent failure)', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: { message: 'DB error' } } })
    mockCreateClient.mockResolvedValue(client as never)

    const { POST } = await importRoute()
    const res = await POST(makePostRequest({ name: 'Creatine' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
  })
})

describe('DELETE /api/settings/supplement', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest('supp-1'))
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json).toEqual({ error: 'Unauthorized' })
  })

  it('returns 400 when id is missing from query string', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'No id' })
  })

  it('calls delete with correct id and user_id filters', async () => {
    const { client, queryBuilder } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest('supp-99'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
    expect(client.from).toHaveBeenCalledWith('user_supplements')
    expect(queryBuilder.delete).toHaveBeenCalled()
    expect(queryBuilder.eq).toHaveBeenCalledWith('id', 'supp-99')
    expect(queryBuilder.eq).toHaveBeenCalledWith('user_id', 'user-123')
  })

  it('returns { success: true } on success', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest('supp-1'))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('calls invalidateUserSettingsCache with user id after successful delete', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    await DELETE(makeDeleteRequest('supp-42'))

    expect(mockInvalidateUserSettingsCache).toHaveBeenCalledTimes(1)
    expect(mockInvalidateUserSettingsCache).toHaveBeenCalledWith('user-123')
  })

  it('does not call invalidateUserSettingsCache when unauthenticated', async () => {
    const { client } = makeUnauthSupabase()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    await DELETE(makeDeleteRequest('supp-1'))

    expect(mockInvalidateUserSettingsCache).not.toHaveBeenCalled()
  })

  it('does not call invalidateUserSettingsCache when id is missing', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    await DELETE(makeDeleteRequest())

    expect(mockInvalidateUserSettingsCache).not.toHaveBeenCalled()
  })

  it('returns 400 when id query param is an empty string', async () => {
    const { client } = makeSupabaseMock()
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest(null))
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'No id' })
  })

  it('returns { success: true } even when supabase delete returns a database error (silent failure)', async () => {
    const { client } = makeSupabaseMock({ queryResult: { data: null, error: { message: 'DB error' } } })
    mockCreateClient.mockResolvedValue(client as never)

    const { DELETE } = await importRoute()
    const res = await DELETE(makeDeleteRequest('supp-1'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ success: true })
  })
})

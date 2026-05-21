import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

async function importRoute() {
  return import('@/app/api/health/route')
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 200 with status: ok', async () => {
    const { GET } = await importRoute()
    const res = await GET()

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
  })

  it('returns a valid ISO 8601 timestamp', async () => {
    const before = Date.now()
    const { GET } = await importRoute()
    const res = await GET()
    const after = Date.now()

    const { timestamp } = await res.json()
    const parsed = new Date(timestamp).getTime()

    expect(Number.isNaN(parsed)).toBe(false)
    expect(parsed).toBeGreaterThanOrEqual(before)
    expect(parsed).toBeLessThanOrEqual(after)
  })

  it('returns version from npm_package_version env var when set', async () => {
    const originalVersion = process.env.npm_package_version
    process.env.npm_package_version = '1.2.3'

    vi.resetModules()
    const { GET } = await importRoute()
    const res = await GET()
    const { version } = await res.json()

    expect(version).toBe('1.2.3')

    process.env.npm_package_version = originalVersion
  })

  it('falls back to "0.1.0" when npm_package_version is not set', async () => {
    const originalVersion = process.env.npm_package_version
    delete process.env.npm_package_version

    vi.resetModules()
    const { GET } = await importRoute()
    const res = await GET()
    const { version } = await res.json()

    expect(version).toBe('0.1.0')

    process.env.npm_package_version = originalVersion
  })

  it('sets Cache-Control: no-store header', async () => {
    const { GET } = await importRoute()
    const res = await GET()

    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('returns all three expected fields: status, version, timestamp', async () => {
    const { GET } = await importRoute()
    const res = await GET()
    const json = await res.json()

    expect(json).toHaveProperty('status')
    expect(json).toHaveProperty('version')
    expect(json).toHaveProperty('timestamp')
    expect(Object.keys(json)).toHaveLength(3)
  })

  it('does not require authentication', async () => {
    // The health route must be importable and callable without any auth mock.
    // If it tried to call createClient or check a session this would throw.
    const { GET } = await importRoute()
    await expect(GET()).resolves.toBeDefined()
  })
})

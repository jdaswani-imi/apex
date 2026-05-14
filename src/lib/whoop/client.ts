import { createClient } from '@/lib/supabase/server'

const WHOOP_BASE = 'https://api.prod.whoop.com/developer'
const MAX_PAGES = 10        // cap per endpoint: 250 records max
const PAGE_DELAY_MS = 700   // ~85 req/min ceiling, well under 100/min limit

export async function getWhoopToken(userId: string): Promise<string | null> {
  const supabase = await createClient()

  const { data: tokenRow } = await supabase
    .from('whoop_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!tokenRow) return null

  if (new Date(tokenRow.expires_at) <= new Date()) {
    if (!tokenRow.refresh_token) return null

    const refreshRes = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenRow.refresh_token,
        client_id: process.env.WHOOP_CLIENT_ID!,
        client_secret: process.env.WHOOP_CLIENT_SECRET!,
      }),
    })

    if (!refreshRes.ok) return null

    const newTokens = await refreshRes.json()
    const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString()

    await supabase.from('whoop_tokens').update({
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)

    return newTokens.access_token
  }

  return tokenRow.access_token
}

export async function whoopFetch(
  userId: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<unknown> {
  const token = await getWhoopToken(userId)
  if (!token) throw new Error('No Whoop token')

  const url = new URL(`${WHOOP_BASE}${endpoint}`)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) throw new Error(`Whoop API error: ${res.status}`)
  return res.json()
}

// Fetches all pages for list endpoints, respecting rate limits.
// Stops at MAX_PAGES to stay safely within the 10k/day limit.
export async function whoopFetchAll(
  userId: string,
  endpoint: string,
  params?: Record<string, string>
): Promise<unknown[]> {
  const token = await getWhoopToken(userId)
  if (!token) throw new Error('No Whoop token')

  const records: unknown[] = []
  let nextToken: string | null = null
  let pages = 0

  do {
    if (pages > 0) await new Promise(r => setTimeout(r, PAGE_DELAY_MS))

    const url = new URL(`${WHOOP_BASE}${endpoint}`)
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    url.searchParams.set('limit', '25')
    if (nextToken) url.searchParams.set('nextToken', nextToken)

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error(`Whoop API error: ${res.status}`)

    const body = await res.json()
    records.push(...(body.records ?? []))
    nextToken = body.next_token ?? null
    pages++
  } while (nextToken && pages < MAX_PAGES)

  return records
}

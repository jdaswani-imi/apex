import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export async function getCachedAI<T>(key: string): Promise<T | null> {
  try {
    return await redis.get<T>(key)
  } catch {
    return null
  }
}

export async function setCachedAI<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, value, { ex: ttlSeconds })
  } catch {
    // Non-fatal — response still serves without caching
  }
}

export async function delCachedAI(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys)
  } catch {
    // Non-fatal
  }
}

// Wipe all AI-generated content for a user on the current date.
// Call this after food mutations or WHOOP syncs so stale briefs aren't served.
export async function invalidateUserAICaches(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const TIP_PAGES = ['food', 'today', 'training', 'sleep', 'supplements']
  await delCachedAI(
    `ai:brief:${userId}:${today}`,
    `ai:morning:${userId}:${today}`,
    ...TIP_PAGES.map(p => `ai:tip:${userId}:${p}:${today}`),
  )
}

// Wipe cached user settings rows. Call after settings mutations.
export async function invalidateUserSettingsCache(userId: string): Promise<void> {
  await delCachedAI(
    `db:profile:${userId}`,
    `db:goals:${userId}`,
    `db:training:${userId}`,
    `db:lifestyle:${userId}`,
    `db:supplements:${userId}`,
    `db:supp-adherence:${userId}:7`,
    `db:supp-adherence:${userId}:30`,
  )
}

// Wipe cached food data for a specific date. Call after food log mutations.
export async function invalidateUserFoodCache(userId: string, date: string): Promise<void> {
  await delCachedAI(
    `db:food-totals:${userId}:${date}`,
    `db:recent-logs:${userId}:14`,
    `db:recent-logs:${userId}:8`,
    `db:recent-foods:${userId}`,
  )
}

// Wipe cached WHOOP data. Call after a WHOOP sync.
export async function invalidateUserWhoopCache(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  await delCachedAI(
    `db:recovery:${userId}:${today}`,
    `db:recovery:${userId}:${yesterday}`,
    `db:sleep:${userId}:${today}`,
    `db:sleep:${userId}:${yesterday}`,
    `db:recent-recovery:${userId}:14`,
    `db:recent-recovery:${userId}:8`,
    `db:recent-sleep:${userId}:14`,
    `db:recent-sleep:${userId}:8`,
  )
}

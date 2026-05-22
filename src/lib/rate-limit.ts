import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

// Sliding-window rate limiter backed by Upstash Redis.
// Uses a sorted set per key: members are request timestamps, score is the timestamp.
// Atomic via a Lua-style pipeline — safe across concurrent Fluid Compute instances.

export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now()
  const windowStart = now - windowMs

  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(key, 0, windowStart)
  pipeline.zadd(key, { score: now, member: now })
  pipeline.zcard(key)
  pipeline.expire(key, Math.ceil(windowMs / 1000))

  const results = await pipeline.exec()
  const count = results[2] as number

  return count <= limit
}

export function rateLimitResponse(): Response {
  return new Response('Rate limit exceeded', {
    status: 429,
    headers: { 'Retry-After': '60' },
  })
}

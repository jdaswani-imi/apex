import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { delCachedAI } from '@/lib/ai-cache'

// POST /api/daily-log/steps/backfill
// Body: [{ date: "2026-05-26", steps: 9200 }, ...]
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!Array.isArray(body)) {
    return NextResponse.json({ error: 'Body must be an array of { date, steps }' }, { status: 400 })
  }

  const invalid = body.filter(e => !e.date || typeof e.steps !== 'number' || e.steps < 0)
  if (invalid.length > 0) {
    return NextResponse.json({ error: 'Each entry must have date (string) and steps (number ≥ 0)', invalid }, { status: 400 })
  }

  const rows = body.map((e: { date: string; steps: number }) => ({
    user_id: user.id,
    date: e.date,
    steps: e.steps,
  }))

  const { error } = await supabase
    .from('daily_logs')
    .upsert(rows, { onConflict: 'user_id,date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await delCachedAI(
    `db:recent-logs:${user.id}:8`,
    `db:recent-logs:${user.id}:14`,
    `db:recent-logs:${user.id}:30`,
  )

  return NextResponse.json({ ok: true, saved: rows.length })
}

import { NextResponse } from 'next/server'
import { todayLocal, localDateStr } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { ensureSupplementRows } from '@/lib/db'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_BACKFILL_DAYS = 120

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  if ((fromParam && !ISO_DATE.test(fromParam)) || (toParam && !ISO_DATE.test(toParam))) {
    return NextResponse.json({ error: 'Invalid date format, expected YYYY-MM-DD' }, { status: 400 })
  }

  // Default: start from when their first supplement was created
  const { data: earliest } = await supabase
    .from('user_supplements')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const fromDate = fromParam
    ?? earliest?.created_at?.split('T')[0]
    ?? todayLocal()

  const toDate = toParam ?? todayLocal()

  const from = new Date(fromDate + 'T12:00:00')
  const to = new Date(toDate + 'T12:00:00')

  // Cap the span so a wide range (e.g. ?from=1900-01-01) can't fan out into
  // tens of thousands of sequential DB round trips.
  const spanDays = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  if (spanDays > MAX_BACKFILL_DAYS) {
    return NextResponse.json(
      { error: `Range too large (max ${MAX_BACKFILL_DAYS} days)` },
      { status: 400 },
    )
  }

  const processed: string[] = []
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dateStr = localDateStr(d)
    await ensureSupplementRows(user.id, dateStr)
    processed.push(dateStr)
  }

  return NextResponse.json({ ok: true, processed: processed.length, from: fromDate, to: toDate })
}

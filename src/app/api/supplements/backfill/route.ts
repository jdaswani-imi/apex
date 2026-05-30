import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureSupplementRows } from '@/lib/db'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Default: start from when their first supplement was created
  const { data: earliest } = await supabase
    .from('user_supplements')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  const fromDate = searchParams.get('from')
    ?? earliest?.created_at?.split('T')[0]
    ?? new Date().toISOString().split('T')[0]

  const toDate = searchParams.get('to') ?? new Date().toISOString().split('T')[0]

  const from = new Date(fromDate + 'T12:00:00')
  const to = new Date(toDate + 'T12:00:00')
  const processed: string[] = []

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0]
    await ensureSupplementRows(user.id, dateStr)
    processed.push(dateStr)
  }

  return NextResponse.json({ ok: true, processed: processed.length, from: fromDate, to: toDate })
}

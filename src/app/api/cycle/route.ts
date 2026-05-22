import { createClient } from '@/lib/supabase/server'
import { getRecentMenstrualCycles, upsertMenstrualCycle, deleteMenstrualCycle } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cycles = await getRecentMenstrualCycles(12)
  return NextResponse.json(cycles, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { period_start_date, period_end_date, cycle_length_days, notes } = body

  if (!period_start_date) {
    return NextResponse.json({ error: 'period_start_date is required' }, { status: 400 })
  }

  const cycle = await upsertMenstrualCycle({
    period_start_date,
    period_end_date: period_end_date ?? null,
    cycle_length_days: cycle_length_days ?? 28,
    notes: notes ?? null,
  })

  return NextResponse.json(cycle)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await deleteMenstrualCycle(id)
  return NextResponse.json({ ok: true })
}

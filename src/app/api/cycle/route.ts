import { getRecentMenstrualCycles, upsertMenstrualCycle, deleteMenstrualCycle } from '@/lib/db'

export async function GET() {
  const cycles = await getRecentMenstrualCycles(12)
  return Response.json(cycles)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { period_start_date, period_end_date, cycle_length_days, notes } = body

  if (!period_start_date) {
    return Response.json({ error: 'period_start_date is required' }, { status: 400 })
  }

  const cycle = await upsertMenstrualCycle({
    period_start_date,
    period_end_date: period_end_date ?? null,
    cycle_length_days: cycle_length_days ?? 28,
    notes: notes ?? null,
  })

  return Response.json(cycle)
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })
  await deleteMenstrualCycle(id)
  return Response.json({ ok: true })
}

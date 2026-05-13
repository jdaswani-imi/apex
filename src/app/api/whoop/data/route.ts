import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRecentRecovery, getRecentSleep, getRecentCycles, getRecentWorkouts } from '@/lib/db'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [recovery, sleep, cycles, workouts] = await Promise.all([
    getRecentRecovery(30),
    getRecentSleep(30),
    getRecentCycles(30),
    getRecentWorkouts(30),
  ])

  return NextResponse.json({ recovery, sleep, cycles, workouts })
}

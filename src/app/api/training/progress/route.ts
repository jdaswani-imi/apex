import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data: baselines } = await supabase
    .from('exercise_baselines')
    .select('*')
    .eq('user_id', user.id)
    .order('session_type', { ascending: true })

  if (!baselines || baselines.length === 0) return NextResponse.json([])

  // Fetch all recent exercises for this user in a single query, then correlate in-memory.
  // This avoids an N+1 pattern where each baseline would trigger a separate DB round-trip.
  const exerciseNames = baselines.map(b => b.exercise_name as string)

  // Use an OR filter to fetch the most recent exercise per name in one request.
  // We fetch the last 200 records (generous upper bound) and pick the most recent per name.
  const { data: recentExercises } = await supabase
    .from('exercises')
    .select('name, weight_kg, reps, created_at, training_sessions!inner(user_id)')
    .eq('training_sessions.user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  // Build a map of exercise name → most recent record (case-insensitive partial match)
  const lastExByName: Record<string, { weight_kg: number | null; reps: number | null; created_at: string } | null> = {}
  for (const name of exerciseNames) {
    const nameLower = name.toLowerCase()
    const match = (recentExercises ?? []).find(
      e => e.name.toLowerCase().includes(nameLower)
    )
    lastExByName[name] = match ?? null
  }

  const withStatus = baselines.map((b) => {
    const lastEx = lastExByName[b.exercise_name as string]

    let progressStatus = 'hold'
    if (!lastEx) {
      progressStatus = 'stale'
    } else if ((lastEx.weight_kg ?? 0) > (b.current_weight_kg as number)) {
      progressStatus = 'progress'
    } else if (
      (lastEx.reps ?? 0) >= (b.target_reps as number) &&
      (lastEx.weight_kg ?? 0) >= (b.current_weight_kg as number)
    ) {
      progressStatus = 'progress'
    } else if ((lastEx.reps ?? 0) < (b.current_reps as number)) {
      progressStatus = 'regression'
    }

    return { ...b, progressStatus, lastPerformance: lastEx }
  })

  return NextResponse.json(withStatus)
}

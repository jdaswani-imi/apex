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

  const withStatus = await Promise.all((baselines ?? []).map(async (b) => {
    const { data: lastEx } = await supabase
      .from('exercises')
      .select('weight_kg, reps, created_at, training_sessions!inner(user_id)')
      .eq('training_sessions.user_id', user.id)
      .ilike('name', `%${b.exercise_name}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let progressStatus = 'hold'
    if (!lastEx) {
      progressStatus = 'stale'
    } else if (lastEx.weight_kg > b.current_weight_kg) {
      progressStatus = 'progress'
    } else if (lastEx.reps >= b.target_reps && lastEx.weight_kg >= b.current_weight_kg) {
      progressStatus = 'progress'
    } else if (lastEx.reps < b.current_reps) {
      progressStatus = 'regression'
    }

    return { ...b, progressStatus, lastPerformance: lastEx }
  }))

  return NextResponse.json(withStatus)
}

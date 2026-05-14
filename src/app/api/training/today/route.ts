import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({})

  const today = new Date().toISOString().split('T')[0]
  const dayNum = new Date().getDay()

  const { data: training } = await supabase
    .from('user_training')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const sessionType = training?.training_split?.[String(dayNum)] ?? 'Rest'

  const typeMap: Record<string, string> = {
    'upper push': 'push', 'push': 'push',
    'upper pull': 'pull', 'pull': 'pull',
    'legs': 'legs', 'lower body': 'legs',
    'arms': 'arms', 'cardio': 'cardio',
    'cricket': 'cricket',
  }
  const baselineType = Object.entries(typeMap).find(([k]) =>
    sessionType.toLowerCase().includes(k)
  )?.[1] ?? null

  let exercises: Record<string, unknown>[] = []
  if (baselineType && !['cardio', 'cricket', 'rest'].includes(baselineType)) {
    const { data: baselines } = await supabase
      .from('exercise_baselines')
      .select('*')
      .eq('user_id', user.id)
      .eq('session_type', baselineType)
      .order('exercise_name', { ascending: true })

    // Batch-fetch recent exercises for all baselines in a single query to avoid N+1.
    const { data: recentExercises } = await supabase
      .from('exercises')
      .select('name, weight_kg, reps, sets, training_sessions!inner(date, user_id)')
      .eq('training_sessions.user_id', user.id)
      .order('training_sessions(date)', { ascending: false })
      .limit(200)

    // Map each baseline to its most recent matching exercise (case-insensitive)
    exercises = (baselines ?? []).map((b) => {
      const nameLower = (b.exercise_name as string).toLowerCase()
      const lastEx = (recentExercises ?? []).find(
        e => e.name.toLowerCase().includes(nameLower)
      ) ?? null

      let progressStatus = 'hold'
      if (lastEx) {
        if (
          (lastEx.weight_kg ?? 0) > (b.current_weight_kg as number) ||
          ((lastEx.weight_kg ?? 0) === (b.current_weight_kg as number) && (lastEx.reps ?? 0) >= (b.target_reps as number))
        ) {
          progressStatus = 'progress'
        } else if ((lastEx.reps ?? 0) < (b.current_reps as number)) {
          progressStatus = 'regression'
        }
      }

      return { ...b, lastPerformance: lastEx, progressStatus }
    })
  }

  const { data: todaySession } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const { data: lastSession } = await supabase
    .from('training_sessions')
    .select('*')
    .eq('user_id', user.id)
    .ilike('session_type', `%${baselineType ?? ''}%`)
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  const { data: recovery } = await supabase
    .from('whoop_recovery')
    .select('recovery_score')
    .eq('user_id', user.id)
    .eq('date', today)
    .single()

  return NextResponse.json({
    sessionType,
    gymName: training?.gym_name ?? 'TopGym',
    exercises,
    todaySession,
    lastSession,
    recovery: recovery?.recovery_score ?? null,
  })
}

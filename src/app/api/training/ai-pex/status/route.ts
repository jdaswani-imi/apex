import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [planRes, sessionCountRes, templatesRes, onboardingRes, baselineCountRes] = await Promise.all([
    supabase.from('ai_pex_plans').select('*').eq('user_id', user.id).single(),
    supabase.from('training_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).not('finished_at', 'is', null),
    supabase.from('workout_templates')
      .select(`
        id, name, description, color, sort_order, day_of_week, ai_rationale,
        template_sections (
          id, name, sort_order,
          template_exercises ( id, exercise_name, sort_order, default_sets, default_reps, notes )
        )
      `)
      .eq('user_id', user.id).eq('source', 'ai_pex').order('sort_order'),
    supabase.from('user_onboarding').select('training_ext').eq('user_id', user.id).single(),
    supabase.from('exercise_baselines')
      .select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const trainingExt = (onboardingRes.data?.training_ext ?? {}) as Record<string, unknown>

  return NextResponse.json({
    plan: planRes.data ?? null,
    has_history: (sessionCountRes.count ?? 0) > 0,
    session_count: sessionCountRes.count ?? 0,
    templates: templatesRes.data ?? [],
    training_days: trainingExt.training_days ?? [],
    gym_type: trainingExt.gym_type ?? null,
    baseline_count: baselineCountRes.count ?? 0,
  })
}

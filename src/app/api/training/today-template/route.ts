import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DAY_SHORT: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
}
const DAY_FULL: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
}
const ORDERED_DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().split('T')[0]
  const dayNum = new Date().getDay()
  const todayShort = DAY_SHORT[dayNum]
  const todayFull = DAY_FULL[dayNum]

  const [planRes, sessionRes] = await Promise.all([
    supabase.from('ai_pex_plans').select('status, training_days').eq('user_id', user.id).single(),
    supabase.from('training_sessions')
      .select('id, template_id', { count: 'exact' })
      .eq('user_id', user.id).eq('date', today).not('finished_at', 'is', null),
  ])

  const plan = planRes.data
  const sessionCount = sessionRes.count ?? 0
  const loggedTemplateIds = (sessionRes.data ?? []).map(s => s.template_id).filter(Boolean)

  // No active plan — fall back to user_training split
  if (!plan || plan.status !== 'active') {
    const { data: training } = await supabase
      .from('user_training').select('training_split').eq('user_id', user.id).single()
    const sessionType = training?.training_split?.[String(dayNum)] ?? 'Rest'
    const isRest = /rest|off/i.test(sessionType)
    return NextResponse.json({ isRest, template: null, sessionType, sessionLogged: sessionCount > 0 })
  }

  const trainingDays: string[] = plan.training_days ?? []
  const isTrainingDay = trainingDays.includes(todayShort) || trainingDays.includes(todayFull)

  if (!isTrainingDay) {
    return NextResponse.json({ isRest: true, template: null, sessionType: 'Rest', sessionLogged: sessionCount > 0 })
  }

  // Try day_of_week column first (newly stored), then fall back to sort_order index
  const { data: allTemplates } = await supabase
    .from('workout_templates')
    .select('id, name, description, color, sort_order, day_of_week')
    .eq('user_id', user.id).eq('source', 'ai_pex').order('sort_order')

  if (!allTemplates?.length) {
    return NextResponse.json({ isRest: false, template: null, sessionType: 'Training', sessionLogged: sessionCount > 0 })
  }

  let template = allTemplates.find(
    t => t.day_of_week === todayFull || t.day_of_week === todayShort
  ) ?? null

  if (!template) {
    const daysOrdered = ORDERED_DAYS_SHORT.filter(d => trainingDays.includes(d))
    const idx = daysOrdered.indexOf(todayShort)
    template = idx !== -1 ? (allTemplates[idx] ?? null) : null
  }

  if (!template) {
    return NextResponse.json({ isRest: false, template: null, sessionType: 'Training', sessionLogged: sessionCount > 0 })
  }

  const { count: exerciseCount } = await supabase
    .from('template_exercises').select('id', { count: 'exact', head: true })
    .eq('template_id', template.id)

  const sessionDone = loggedTemplateIds.includes(template.id)

  return NextResponse.json({
    isRest: false,
    template: { ...template, exerciseCount: exerciseCount ?? 0 },
    sessionType: template.name,
    sessionLogged: sessionCount > 0,
    sessionDone,
  })
}

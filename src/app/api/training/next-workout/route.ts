import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const DAY_SHORT: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
}
const DAY_FULL: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const afterParam = searchParams.get('after') ?? new Date().toISOString().split('T')[0]

  const [planRes, trainingRes, allTemplatesRes] = await Promise.all([
    supabase.from('ai_pex_plans').select('status, training_days').eq('user_id', user.id).single(),
    supabase.from('user_training').select('training_split').eq('user_id', user.id).single(),
    supabase.from('workout_templates')
      .select('id, name, description, color, sort_order, day_of_week')
      .eq('user_id', user.id).eq('source', 'ai_pex').order('sort_order'),
  ])

  const plan = planRes.data
  const allTemplates = allTemplatesRes.data ?? []

  // Resolve the last completed template so we can advance the cycle
  let cycleStartIdx = 0
  if (allTemplates.length > 0) {
    const { data: lastSession } = await supabase
      .from('training_sessions')
      .select('template_id')
      .eq('user_id', user.id)
      .not('finished_at', 'is', null)
      .not('template_id', 'is', null)
      .in('template_id', allTemplates.map(t => t.id))
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (lastSession?.template_id) {
      const lastIdx = allTemplates.findIndex(t => t.id === lastSession.template_id)
      if (lastIdx !== -1) cycleStartIdx = (lastIdx + 1) % allTemplates.length
    }
  }

  let cycleAdvance = 0 // how many training days we've passed to advance the cycle

  for (let i = 1; i <= 14; i++) {
    const checkDate = addDays(afterParam, i)
    const dayNum = new Date(checkDate + 'T12:00:00').getDay()
    const dayShort = DAY_SHORT[dayNum]

    const daysAway = i
    const dayLabel = i === 1 ? 'Tomorrow' : DAY_FULL[dayNum]

    if (!plan || plan.status !== 'active') {
      const split = trainingRes.data?.training_split ?? {}
      const sessionType = split[String(dayNum)] ?? 'Rest'
      if (/rest|off/i.test(sessionType)) continue
      return NextResponse.json({ daysAway, date: checkDate, dayLabel, template: null, sessionType })
    }

    const trainingDays: string[] = plan.training_days ?? []
    const isTrainingDay = trainingDays.includes(dayShort) || trainingDays.includes(DAY_FULL[dayNum])
    if (!isTrainingDay) continue

    // Cycle continuation is the single source of truth.
    // day_of_week is intentionally not used — it produces wrong results after any deviation.
    const template = allTemplates.length > 0
      ? (allTemplates[(cycleStartIdx + cycleAdvance) % allTemplates.length] ?? null)
      : null

    cycleAdvance++

    if (!template) {
      return NextResponse.json({ daysAway, date: checkDate, dayLabel, template: null, sessionType: 'Training' })
    }

    const { count: exerciseCount } = await supabase
      .from('template_exercises').select('id', { count: 'exact', head: true })
      .eq('template_id', template.id)

    return NextResponse.json({
      daysAway,
      date: checkDate,
      dayLabel,
      template: { ...template, exerciseCount: exerciseCount ?? 0 },
      sessionType: template.name,
    })
  }

  return NextResponse.json(null)
}

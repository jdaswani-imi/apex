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

  for (let i = 1; i <= 14; i++) {
    const checkDate = addDays(afterParam, i)
    const dayNum = new Date(checkDate + 'T12:00:00').getDay()
    const dayShort = DAY_SHORT[dayNum]
    const dayFull = DAY_FULL[dayNum]

    const daysAway = i
    const dayLabel = i === 1 ? 'Tomorrow' : dayFull

    if (!plan || plan.status !== 'active') {
      // Fall back to manual training_split
      const split = trainingRes.data?.training_split ?? {}
      const sessionType = split[String(dayNum)] ?? 'Rest'
      if (/rest|off/i.test(sessionType)) continue
      return NextResponse.json({ daysAway, date: checkDate, dayLabel, template: null, sessionType })
    }

    const trainingDays: string[] = plan.training_days ?? []
    const isTrainingDay = trainingDays.includes(dayShort) || trainingDays.includes(dayFull)
    if (!isTrainingDay) continue

    let template = allTemplates.find(
      t => t.day_of_week === dayFull || t.day_of_week === dayShort
    ) ?? null

    if (!template) {
      const daysOrdered = ORDERED_DAYS_SHORT.filter(d => trainingDays.includes(d))
      const trainingIdx = daysOrdered.indexOf(dayShort)
      template = trainingIdx !== -1 ? (allTemplates[trainingIdx] ?? null) : null
    }

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

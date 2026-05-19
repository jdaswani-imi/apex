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

async function resolveTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateStr: string,
  plan: { status: string; training_days: string[] } | null,
  allTemplates: { id: string; name: string; description: string; color: string; sort_order: number; day_of_week: string | null }[],
  trainingRes: { training_split: Record<string, string> } | null,
) {
  const dayNum = new Date(dateStr + 'T12:00:00').getDay()
  const dayShort = DAY_SHORT[dayNum]
  const dayFull = DAY_FULL[dayNum]

  if (!plan || plan.status !== 'active') {
    const split = trainingRes?.training_split ?? {}
    const sessionType = split[String(dayNum)] ?? 'Rest'
    return { isRest: /rest|off/i.test(sessionType), template: null, sessionType }
  }

  const trainingDays: string[] = plan.training_days ?? []
  const isTrainingDay = trainingDays.includes(dayShort) || trainingDays.includes(dayFull)
  if (!isTrainingDay) return { isRest: true, template: null, sessionType: 'Rest' }

  let template = allTemplates.find(
    t => t.day_of_week === dayFull || t.day_of_week === dayShort,
  ) ?? null

  if (!template) {
    const daysOrdered = ORDERED_DAYS_SHORT.filter(d => trainingDays.includes(d))
    const idx = daysOrdered.indexOf(dayShort)
    template = idx !== -1 ? (allTemplates[idx] ?? null) : null
  }

  if (!template) return { isRest: false, template: null, sessionType: 'Training' }

  const { count: exerciseCount } = await supabase
    .from('template_exercises').select('id', { count: 'exact', head: true })
    .eq('template_id', template.id)

  return {
    isRest: false,
    template: { ...template, exerciseCount: exerciseCount ?? 0 },
    sessionType: template.name,
  }
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const todayStr = new Date().toISOString().split('T')[0]
  const dateParam = searchParams.get('date') ?? todayStr

  // Fetch shared data in parallel
  const [planRes, sessionRes, trainingRes, allTemplatesRes] = await Promise.all([
    supabase.from('ai_pex_plans').select('status, training_days').eq('user_id', user.id).single(),
    supabase.from('training_sessions')
      .select('id, template_id, session_type', { count: 'exact' })
      .eq('user_id', user.id).eq('date', dateParam).not('finished_at', 'is', null),
    supabase.from('user_training').select('training_split').eq('user_id', user.id).single(),
    supabase.from('workout_templates')
      .select('id, name, description, color, sort_order, day_of_week')
      .eq('user_id', user.id).eq('source', 'ai_pex').order('sort_order'),
  ])

  const plan = planRes.data
  const allTemplates = allTemplatesRes.data ?? []
  const trainingData = trainingRes.data

  const sessionCount = sessionRes.count ?? 0
  const loggedSessions = sessionRes.data ?? []
  const loggedTemplateIds = loggedSessions.map(s => s.template_id).filter(Boolean)
  const alternativeSession = sessionCount > 0 && !loggedTemplateIds.length
    ? loggedSessions[0]?.session_type ?? null
    : null

  const { isRest, template, sessionType } = await resolveTemplate(
    supabase, user.id, dateParam, plan, allTemplates, trainingData,
  )

  const today = {
    isRest,
    template,
    sessionType,
    sessionLogged: sessionCount > 0,
    sessionDone: sessionCount > 0,
    alternativeSession,
  }

  // Only look up next workout when it's actually needed (rest or done day)
  let next = null
  if (isRest || sessionCount > 0) {
    for (let i = 1; i <= 14; i++) {
      const checkDate = addDays(dateParam, i)
      const dayNum = new Date(checkDate + 'T12:00:00').getDay()
      const dayShort = DAY_SHORT[dayNum]
      const dayFull = DAY_FULL[dayNum]
      const dayLabel = i === 1 ? 'Tomorrow' : DAY_FULL[dayNum]

      const { isRest: checkRest, template: nextTemplate, sessionType: nextType } = await resolveTemplate(
        supabase, user.id, checkDate, plan, allTemplates, trainingData,
      )

      if (!checkRest) {
        void dayShort; void dayFull
        next = { daysAway: i, date: checkDate, dayLabel, template: nextTemplate, sessionType: nextType }
        break
      }
    }
  }

  // Cache historical dates for 1 hour; today for 60 seconds
  const isPast = dateParam < todayStr
  const headers = new Headers({
    'Cache-Control': isPast ? 'private, max-age=3600' : 'private, max-age=60, must-revalidate',
  })

  return NextResponse.json({ today, next }, { headers })
}

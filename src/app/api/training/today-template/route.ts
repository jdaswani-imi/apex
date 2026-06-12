import { createClient } from '@/lib/supabase/server'
import { todayLocal } from '@/lib/date'
import { NextResponse } from 'next/server'

const DAY_SHORT: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
}
const DAY_FULL: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
}

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')
  const todayStr = todayLocal()
  const today = dateParam ?? todayStr
  const dayNum = new Date(today + 'T12:00:00').getDay()
  const todayShort = DAY_SHORT[dayNum]
  const todayFull = DAY_FULL[dayNum]

  const [planRes, sessionRes] = await Promise.all([
    supabase.from('ai_pex_plans').select('status, training_days').eq('user_id', user.id).single(),
    supabase.from('training_sessions')
      .select('id, template_id, session_type', { count: 'exact' })
      .eq('user_id', user.id).eq('date', today).not('finished_at', 'is', null),
  ])

  const plan = planRes.data
  const sessionCount = sessionRes.count ?? 0
  const loggedSessions = sessionRes.data ?? []
  const loggedTemplateIds = loggedSessions.map(s => s.template_id).filter(Boolean)
  const alternativeSession = sessionCount > 0 && !loggedTemplateIds.length
    ? loggedSessions[0]?.session_type ?? null
    : null

  // No active plan — fall back to user_training split
  if (!plan || plan.status !== 'active') {
    const { data: training } = await supabase
      .from('user_training').select('training_split').eq('user_id', user.id).single()
    const sessionType = training?.training_split?.[String(dayNum)] ?? 'Rest'
    const isRest = /rest|off/i.test(sessionType)
    return NextResponse.json({ isRest, template: null, sessionType, sessionLogged: sessionCount > 0, sessionDone: sessionCount > 0, alternativeSession })
  }

  const trainingDays: string[] = plan.training_days ?? []
  const isTrainingDay = trainingDays.includes(todayShort) || trainingDays.includes(todayFull)

  // Fetch templates regardless — needed for both training days and rest-day deviation handling
  const { data: allTemplates } = await supabase
    .from('workout_templates')
    .select('id, name, description, color, sort_order, day_of_week')
    .eq('user_id', user.id).eq('source', 'ai_pex').order('sort_order')

  // If user trained on a rest day (finished session exists despite not being a training day),
  // treat it as done rather than showing a rest card — the cycle advanced from this session.
  if (!isTrainingDay) {
    if (sessionCount > 0) {
      const doneTemplateId = loggedTemplateIds[0] ?? null
      const doneTemplate = doneTemplateId ? (allTemplates ?? []).find(t => t.id === doneTemplateId) ?? null : null
      const { count: exerciseCount } = doneTemplate
        ? await supabase.from('template_exercises').select('id', { count: 'exact', head: true }).eq('template_id', doneTemplate.id)
        : { count: 0 }
      return NextResponse.json({
        isRest: false,
        trainedOnRestDay: true,
        template: doneTemplate ? { ...doneTemplate, exerciseCount: exerciseCount ?? 0 } : null,
        sessionType: doneTemplate?.name ?? loggedSessions[0]?.session_type ?? 'Workout',
        sessionLogged: true,
        sessionDone: true,
        alternativeSession: !doneTemplateId ? (loggedSessions[0]?.session_type ?? null) : null,
      })
    }
    return NextResponse.json({ isRest: true, template: null, sessionType: 'Rest', sessionLogged: false })
  }

  if (!allTemplates?.length) {
    return NextResponse.json({ isRest: false, template: null, sessionType: 'Training', sessionLogged: sessionCount > 0 })
  }

  // 1st: if today already has a finished session, reflect that template
  const todayTemplateId = loggedTemplateIds[0] ?? null
  let template = todayTemplateId
    ? (allTemplates.find(t => t.id === todayTemplateId) ?? null)
    : null

  // 2nd: cycle continuation — what's next based on the last real completed session.
  // This is the single source of truth regardless of what day it is. day_of_week is
  // intentionally not used here: it breaks after any deviation (rest on training day,
  // or training on rest day) because it always maps to the originally planned template.
  if (!template) {
    const { data: lastSession } = await supabase
      .from('training_sessions')
      .select('template_id')
      .eq('user_id', user.id)
      .not('finished_at', 'is', null)
      .not('template_id', 'is', null)
      .in('template_id', allTemplates.map(t => t.id))
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (lastSession?.template_id) {
      const lastIdx = allTemplates.findIndex(t => t.id === lastSession.template_id)
      if (lastIdx !== -1) {
        template = allTemplates[(lastIdx + 1) % allTemplates.length] ?? null
      }
    } else {
      template = allTemplates[0] ?? null
    }
  }

  if (!template) {
    return NextResponse.json({ isRest: false, template: null, sessionType: 'Training', sessionLogged: sessionCount > 0 })
  }

  const { count: exerciseCount } = await supabase
    .from('template_exercises').select('id', { count: 'exact', head: true })
    .eq('template_id', template.id)

  const sessionDone = sessionCount > 0

  return NextResponse.json({
    isRest: false,
    template: { ...template, exerciseCount: exerciseCount ?? 0 },
    sessionType: template.name,
    sessionLogged: sessionCount > 0,
    sessionDone,
    alternativeSession,
  })
}

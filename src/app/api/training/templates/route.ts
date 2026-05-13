import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: templates } = await supabase
    .from('workout_templates')
    .select('id, name, description, color, sort_order')
    .eq('user_id', user.id)
    .order('sort_order')

  if (!templates) return NextResponse.json([])

  // Attach last-used date for each template
  const templateIds = templates.map(t => t.id)
  const { data: lastSessions } = await supabase
    .from('training_sessions')
    .select('template_id, date')
    .eq('user_id', user.id)
    .in('template_id', templateIds)
    .not('finished_at', 'is', null)
    .order('date', { ascending: false })

  const lastUsedMap: Record<string, string> = {}
  for (const s of lastSessions ?? []) {
    if (s.template_id && !lastUsedMap[s.template_id]) {
      lastUsedMap[s.template_id] = s.date
    }
  }

  return NextResponse.json(
    templates.map(t => ({ ...t, last_used: lastUsedMap[t.id] ?? null }))
  )
}

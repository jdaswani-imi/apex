import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Template + sections + exercises + sets in one query
  const { data: template } = await supabase
    .from('workout_templates')
    .select(`
      id, name, description, color,
      template_sections (
        id, name, sort_order,
        template_exercises (
          id, exercise_name, sort_order, is_superset, superset_group,
          default_sets, default_reps, default_weight_kg, rest_seconds, notes,
          template_sets (
            id, set_type, set_number, default_reps, default_weight_kg
          )
        )
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Sort sections and exercises — Supabase nested query returns untyped arrays
  type RawSet = { set_type: string; set_number: number; [k: string]: unknown }
  type RawExercise = { exercise_name: string; sort_order: number; template_sets?: RawSet[]; [k: string]: unknown }
  type RawSection = { sort_order: number; template_exercises?: RawExercise[]; [k: string]: unknown }

  const sections = ((template.template_sections ?? []) as RawSection[])
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(section => ({
      ...section,
      exercises: ((section.template_exercises ?? []) as RawExercise[])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(ex => ({
          ...ex,
          sets: ((ex.template_sets ?? []) as RawSet[]).sort((a, b) => {
            if (a.set_type === 'warmup' && b.set_type !== 'warmup') return -1
            if (a.set_type !== 'warmup' && b.set_type === 'warmup') return 1
            return a.set_number - b.set_number
          }),
        })),
    }))

  // Last session data for this template
  const { data: lastSession } = await supabase
    .from('training_sessions')
    .select('id, date, volume_kg, duration_min')
    .eq('user_id', user.id)
    .eq('template_id', id)
    .not('finished_at', 'is', null)
    .order('date', { ascending: false })
    .limit(1)
    .single()

  let lastExercises: Record<string, unknown>[] = []
  if (lastSession) {
    const { data: exs } = await supabase
      .from('exercises')
      .select('name, set_number, set_type, weight_kg, reps, is_pr')
      .eq('session_id', lastSession.id)
      .eq('is_completed', true)
      .order('set_number')
    lastExercises = exs ?? []
  }

  // Group last exercises by name
  const lastPerf: Record<string, Record<string, unknown>[]> = {}
  for (const ex of lastExercises) {
    const exName = ex.name as string
    if (!lastPerf[exName]) lastPerf[exName] = []
    lastPerf[exName].push(ex)
  }

  // Fetch gif URLs for all unique exercise names
  const exerciseNames = [
    ...new Set(sections.flatMap(s => s.exercises.map(e => e.exercise_name as string))),
  ]
  const mediaByName: Record<string, {
    gif_url: string | null; gif_url_female: string | null
    instructions: string[]; primary_muscles: string[]; secondary_muscles: string[]
    equipment: string | null; level: string | null; mechanic: string | null; force: string | null; category: string | null
  }> = {}
  if (exerciseNames.length > 0) {
    const fields = 'name, name_aliases, gif_url, gif_url_female, image_url, instructions, primary_muscles, secondary_muscles, equipment, level, mechanic, force, category'

    // Exact name matches
    const { data: exactRows } = await supabase
      .from('exercise_library')
      .select(fields)
      .in('name', exerciseNames)

    const matched = new Set<string>()
    for (const row of exactRows ?? []) {
      const entry = {
        gif_url: row.gif_url ?? row.image_url,
        gif_url_female: row.gif_url_female ?? row.image_url,
        instructions: row.instructions ?? [],
        primary_muscles: row.primary_muscles ?? [],
        secondary_muscles: row.secondary_muscles ?? [],
        equipment: row.equipment ?? null,
        level: row.level ?? null,
        mechanic: row.mechanic ?? null,
        force: row.force ?? null,
        category: row.category ?? null,
      }
      mediaByName[row.name] = entry
      matched.add(row.name)
    }

    // Alias fallback for any still-unmatched names
    const unmatched = exerciseNames.filter((n: string) => !matched.has(n))
    if (unmatched.length > 0) {
      const { data: aliasRows } = await supabase
        .from('exercise_library')
        .select(fields)
        .overlaps('name_aliases', unmatched)

      for (const row of aliasRows ?? []) {
        const entry = {
          gif_url: row.gif_url ?? row.image_url,
          gif_url_female: row.gif_url_female ?? row.image_url,
          instructions: row.instructions ?? [],
          primary_muscles: row.primary_muscles ?? [],
          secondary_muscles: row.secondary_muscles ?? [],
          equipment: row.equipment ?? null,
          level: row.level ?? null,
          mechanic: row.mechanic ?? null,
          force: row.force ?? null,
          category: row.category ?? null,
        }
        // Map back to each alias that was requested
        for (const alias of (row.name_aliases ?? []) as string[]) {
          if (unmatched.includes(alias)) mediaByName[alias] = entry
        }
      }
    }
  }

  return NextResponse.json({
    id: template.id,
    name: template.name,
    description: template.description,
    color: template.color,
    sections,
    last_session: lastSession ?? null,
    last_performance: lastPerf,
    exercise_media: mediaByName,
  })
}

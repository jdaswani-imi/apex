import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// Map gym type → allowed equipment values from exercise_library
const EQUIPMENT_BY_GYM: Record<string, string[]> = {
  'Commercial gym': ['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'bands', 'kettlebells', 'e-z curl bar', 'exercise ball', 'foam roll', 'medicine ball', 'other'],
  'Home gym': ['barbell', 'dumbbell', 'bands', 'body only', 'kettlebells', 'other'],
  'Dumbbells only': ['dumbbell', 'bands', 'body only', 'other'],
  'Bodyweight only': ['body only'],
  'Hotel/Travel': ['body only', 'bands', 'dumbbell'],
}

interface GeneratedExercise {
  name: string
  sets: number
  reps: string
  rest_seconds: number
  notes?: string
}

interface GeneratedSection {
  name: string
  exercises: GeneratedExercise[]
}

interface GeneratedTemplate {
  day: string
  name: string
  description: string
  color: string
  rationale?: string
  sections: GeneratedSection[]
}

interface GeneratedPlan {
  templates: GeneratedTemplate[]
  notes: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { mode = 'full' } = body // 'full' | 'assessment'

  // ── Gather user context ──────────────────────────────────────────────────────
  const [onboardingRes, profileRes, goalsRes, trainingRes, historyRes] = await Promise.all([
    supabase.from('user_onboarding').select('training_ext, physical, interests').eq('user_id', user.id).single(),
    supabase.from('user_profile').select('name, age, gender, height_cm').eq('user_id', user.id).single(),
    supabase.from('user_goals').select('target_weight_kg, current_weight_kg, body_fat_pct, daily_protein_target_g').eq('user_id', user.id).single(),
    supabase.from('user_training').select('training_split, gym_name, smith_machine_bar_kg').eq('user_id', user.id).single(),
    supabase.from('training_sessions').select('id, date, session_type, volume_kg, duration_min, exercises(name, sets, reps, weight_kg)').eq('user_id', user.id).not('finished_at', 'is', null).order('date', { ascending: false }).limit(10),
  ])

  const trainingExt = (onboardingRes.data?.training_ext ?? {}) as Record<string, unknown>
  const physical = (onboardingRes.data?.physical ?? {}) as Record<string, unknown>
  const interests = (onboardingRes.data?.interests ?? {}) as Record<string, unknown>
  const profile = profileRes.data
  const goals = goalsRes.data
  const userTraining = trainingRes.data
  const history = historyRes.data ?? []

  const gymType = (trainingExt.gym_type as string) ?? 'Commercial gym'
  const trainingDays = (trainingExt.training_days as string[]) ?? []
  const fitnessLevel = (trainingExt.fitness_level as string) ?? (physical.fitness_level as string) ?? 'Intermediate'
  const primaryGoal = (interests.primary_goal as string) ?? 'Build muscle'

  const allowedEquipment = EQUIPMENT_BY_GYM[gymType] ?? EQUIPMENT_BY_GYM['Commercial gym']

  // Fetch exercises filtered by available equipment
  const { data: exerciseLibrary } = await supabase
    .from('exercise_library')
    .select('name, category, equipment, primary_muscles, force, level')
    .in('equipment', allowedEquipment)
    .order('name')
    .limit(500)

  const exerciseList = (exerciseLibrary ?? [])
    .map(e => `${e.name} [${e.equipment}] (${e.primary_muscles?.join(', ') ?? ''}) — ${e.category}`)
    .join('\n')

  const historyStr = history.length > 0
    ? history.map(s => {
        const exList = (s.exercises as Array<{name: string; sets: number | null; reps: number | null; weight_kg: number | null}> ?? [])
          .slice(0, 8)
          .map(e => `  ${e.name}: ${e.sets ?? '?'}×${e.reps ?? '?'} @ ${e.weight_kg ?? '?'}kg`)
          .join('\n')
        return `${s.date} — ${s.session_type} (${s.volume_kg ?? '?'}kg total volume, ${s.duration_min ?? '?'} min)\n${exList}`
      }).join('\n\n')
    : 'No prior training history.'

  const trainingDaysStr = trainingDays.length > 0
    ? trainingDays.join(', ')
    : (userTraining?.training_split
        ? Object.entries(userTraining.training_split as Record<string, string>)
            .filter(([, v]) => v !== 'Rest')
            .map(([k, v]) => { const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; return `${days[Number(k)]} (${v})` })
            .join(', ')
        : 'Monday, Wednesday, Friday')

  // ── Build prompt ─────────────────────────────────────────────────────────────
  const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b', '#06b6d4', '#ec4899']

  const systemPrompt = `You are AI-PEX, an elite AI personal trainer. Your job is to design science-backed workout programs tailored to the individual. You output ONLY valid JSON — no markdown, no explanation.`

  const userPrompt = mode === 'assessment'
    ? `Design a single ASSESSMENT workout for a new user. The goal is to establish baseline strength across key movement patterns.
Rules:
- Use ONLY exercises from the approved list below
- 4-6 exercises covering major patterns (push, pull, hinge/squat, core)
- 3 sets each, rep range 8-10
- Do NOT assign weights — the athlete self-selects based on feel
- Include a warm-up section and main section
- Notes should say "Find a challenging but manageable weight for 8-10 clean reps"

User:
- Name: ${profile?.name ?? 'Athlete'}
- Gender: ${profile?.gender ?? 'male'}
- Gym type: ${gymType}
- Fitness level: ${fitnessLevel}
- Primary goal: ${primaryGoal}

Approved exercises (use ONLY these exact names):
${exerciseList}

Return JSON:
{
  "templates": [{
    "day": "Assessment",
    "name": "Baseline Assessment",
    "description": "Establish your starting strength across all patterns",
    "color": "#f97316",
    "sections": [
      {
        "name": "Warm-Up",
        "exercises": [
          { "name": "...", "sets": 2, "reps": "10", "rest_seconds": 60, "notes": "..." }
        ]
      },
      {
        "name": "Strength Assessment",
        "exercises": [
          { "name": "...", "sets": 3, "reps": "8-10", "rest_seconds": 120, "notes": "Find your working weight — challenging but 2 reps in reserve" }
        ]
      }
    ]
  }],
  "notes": "Complete this session before AI-PEX can personalise your full plan."
}`
    : `Design a complete weekly training program for this athlete.

User profile:
- Name: ${profile?.name ?? 'Athlete'}
- Age: ${profile?.age ?? 'unknown'}, Gender: ${profile?.gender ?? 'male'}
- Height: ${profile?.height_cm ?? '?'}cm
- Current weight: ${goals?.current_weight_kg ?? '?'}kg → Target: ${goals?.target_weight_kg ?? '?'}kg
- Body fat: ${goals?.body_fat_pct ?? '?'}%
- Primary goal: ${primaryGoal}
- Fitness level: ${fitnessLevel}
- Gym type: ${gymType}
- Training days: ${trainingDaysStr}
- Protein target: ${goals?.daily_protein_target_g ?? '?'}g/day

Training history (last 10 sessions):
${historyStr}

Rules:
1. Create ONE template per training day (match exactly the training days listed)
2. Use ONLY exercise names from the approved list below — exact spelling required
3. Each template has sections (Warm-Up, main muscle groups, optional finisher)
4. Prescribe specific sets × reps. Use history to estimate starting weights where possible.
5. Rest periods: compound = 120-180s, isolation = 60-90s
6. Progressive overload built in — increase weight or reps each week
7. Colors for templates: ${COLORS.join(', ')}
8. Descriptions should be short (max 6 words)
9. Add a "rationale" field per template (2-3 sentences) explaining WHY this workout was chosen for this specific athlete on this day — reference their history, goals, or schedule

Approved exercises (use ONLY these exact names):
${exerciseList}

Return JSON exactly:
{
  "templates": [
    {
      "day": "Monday",
      "name": "Push Day",
      "description": "Chest, shoulders, triceps",
      "color": "#f97316",
      "rationale": "Push movements on Monday capitalise on weekend recovery. Based on your training history...",
      "sections": [
        {
          "name": "Warm-Up",
          "exercises": [
            { "name": "...", "sets": 2, "reps": "12", "rest_seconds": 60, "notes": "..." }
          ]
        },
        {
          "name": "Main",
          "exercises": [
            { "name": "...", "sets": 4, "reps": "6-8", "rest_seconds": 180, "notes": "..." }
          ]
        }
      ]
    }
  ],
  "notes": "Brief overall plan rationale"
}`

  // ── Call Claude ──────────────────────────────────────────────────────────────
  let plan: GeneratedPlan
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    // Strip markdown fences if present
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    plan = JSON.parse(cleaned) as GeneratedPlan
  } catch (err) {
    console.error('AI-PEX generation error:', err)
    return NextResponse.json({ error: 'AI generation failed' }, { status: 500 })
  }

  // ── Write templates to DB ────────────────────────────────────────────────────
  // Delete existing AI-PEX templates first (clean slate on regenerate)
  const { data: existingTemplates } = await supabase
    .from('workout_templates')
    .select('id')
    .eq('user_id', user.id)
    .eq('source', 'ai_pex')

  if (existingTemplates && existingTemplates.length > 0) {
    const ids = existingTemplates.map(t => t.id)
    // Cascade: template_sections → template_exercises → template_sets
    const { data: sections } = await supabase.from('template_sections').select('id').in('template_id', ids)
    if (sections && sections.length > 0) {
      const sectionIds = sections.map(s => s.id)
      const { data: exercises } = await supabase.from('template_exercises').select('id').in('section_id', sectionIds)
      if (exercises && exercises.length > 0) {
        await supabase.from('template_sets').delete().in('exercise_id', exercises.map(e => e.id))
      }
      await supabase.from('template_exercises').delete().in('section_id', sectionIds)
    }
    await supabase.from('template_sections').delete().in('template_id', ids)
    await supabase.from('workout_templates').delete().in('id', ids)
  }

  const createdTemplateIds: string[] = []

  for (let tIdx = 0; tIdx < plan.templates.length; tIdx++) {
    const tmpl = plan.templates[tIdx]

    const { data: newTemplate, error: tmplErr } = await supabase
      .from('workout_templates')
      .insert({
        user_id: user.id,
        name: tmpl.name,
        description: tmpl.description,
        color: tmpl.color,
        sort_order: tIdx,
        source: 'ai_pex',
        day_of_week: tmpl.day ?? null,
        ai_rationale: tmpl.rationale ?? null,
      })
      .select('id')
      .single()

    if (tmplErr || !newTemplate) continue
    createdTemplateIds.push(newTemplate.id)

    for (let sIdx = 0; sIdx < (tmpl.sections ?? []).length; sIdx++) {
      const section = tmpl.sections[sIdx]

      const { data: newSection, error: secErr } = await supabase
        .from('template_sections')
        .insert({ template_id: newTemplate.id, name: section.name, sort_order: sIdx })
        .select('id')
        .single()

      if (secErr || !newSection) continue

      for (let eIdx = 0; eIdx < (section.exercises ?? []).length; eIdx++) {
        const ex = section.exercises[eIdx]

        // Parse reps: "8-10" → 8, "12" → 12
        const parsedReps = typeof ex.reps === 'string'
          ? parseInt(ex.reps.split('-')[0], 10) || 10
          : (ex.reps ?? 10)

        const repNote = typeof ex.reps === 'string' && ex.reps.includes('-')
          ? `${ex.reps} reps${ex.notes ? ' · ' + ex.notes : ''}`
          : ex.notes ?? null

        const { data: newExercise, error: exErr } = await supabase
          .from('template_exercises')
          .insert({
            template_id: newTemplate.id,
            section_id: newSection.id,
            user_id: user.id,
            exercise_name: ex.name,
            sort_order: eIdx,
            default_sets: ex.sets,
            default_reps: parsedReps,
            rest_seconds: ex.rest_seconds,
            notes: repNote,
          })
          .select('id')
          .single()

        if (exErr || !newExercise) continue

        // Create individual set rows
        const setRows = Array.from({ length: ex.sets }, (_, i) => ({
          template_exercise_id: newExercise.id,
          set_type: 'working',
          set_number: i + 1,
          default_reps: parsedReps,
          default_weight_kg: null,
        }))

        await supabase.from('template_sets').insert(setRows)
      }
    }
  }

  // ── Upsert ai_pex_plans record ───────────────────────────────────────────────
  const newStatus = mode === 'assessment' ? 'assessment' : 'active'

  await supabase.from('ai_pex_plans').upsert({
    user_id: user.id,
    status: newStatus,
    assessment_done: mode === 'full',
    gym_type: gymType,
    training_days: trainingDays,
    plan_notes: plan.notes,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })

  return NextResponse.json({
    success: true,
    mode,
    templates_created: createdTemplateIds.length,
    notes: plan.notes,
  })
}

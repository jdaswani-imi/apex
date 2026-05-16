import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

interface AnalyzeTarget {
  exercise_name: string
  target_weight_kg: number
  target_reps: number
  current_sets: number
  note: string
  session_type: string
}

interface AnalyzeResult {
  summary: string
  targets: AnalyzeTarget[]
}

type ExerciseRow = {
  name: string
  set_type: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  is_pr: boolean
  is_completed: boolean
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: session } = await supabase
    .from('training_sessions')
    .select('*, exercises(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [profileRes, goalsRes, recoveryRes] = await Promise.all([
    supabase.from('user_profile').select('name, age, gender').eq('user_id', user.id).single(),
    supabase.from('user_goals').select('target_weight_kg, current_weight_kg, daily_protein_target_g').eq('user_id', user.id).single(),
    supabase.from('whoop_recovery').select('recovery_score').eq('user_id', user.id).order('date', { ascending: false }).limit(1).single(),
  ])

  const profile = profileRes.data
  const goals = goalsRes.data
  const recovery = recoveryRes.data

  // Working sets only, completed
  const exercises = (session.exercises as ExerciseRow[] ?? [])
    .filter(e => e.set_type === 'working' && e.is_completed !== false)

  const byName: Record<string, ExerciseRow[]> = {}
  for (const ex of exercises) {
    if (!byName[ex.name]) byName[ex.name] = []
    byName[ex.name].push(ex)
  }

  if (Object.keys(byName).length === 0) {
    return NextResponse.json({
      summary: 'Session saved. Log some sets next time to unlock AI coaching.',
      targets: [],
    })
  }

  // Fetch existing baselines for context
  const exNames = Object.keys(byName)
  const { data: baselines } = await supabase
    .from('exercise_baselines')
    .select('exercise_name, target_weight_kg, target_reps, current_weight_kg, current_reps, current_sets')
    .eq('user_id', user.id)
    .in('exercise_name', exNames)

  const baselineMap: Record<string, { target_weight_kg: number | null; target_reps: number | null }> = {}
  for (const b of baselines ?? []) {
    baselineMap[b.exercise_name] = { target_weight_kg: b.target_weight_kg, target_reps: b.target_reps }
  }

  // Build per-exercise breakdown for the prompt
  const exerciseStr = Object.entries(byName).map(([name, sets]) => {
    const sorted = [...sets].sort((a, b) => a.set_number - b.set_number)
    const setLines = sorted
      .map(s => `  Set ${s.set_number}: ${s.weight_kg ?? '?'}kg × ${s.reps ?? '?'}${s.is_pr ? ' ★PR' : ''}`)
      .join('\n')
    const bl = baselineMap[name]
    const targetStr = bl?.target_weight_kg
      ? ` [Previous target: ${bl.target_weight_kg}kg × ${bl.target_reps}]`
      : ' [No prior target]'
    return `${name}${targetStr}:\n${setLines}`
  }).join('\n\n')

  const recoveryScore = recovery?.recovery_score ?? null
  const recoveryLabel = recoveryScore !== null
    ? recoveryScore >= 67 ? 'Green — high readiness'
      : recoveryScore >= 34 ? 'Yellow — moderate readiness'
      : 'Red — low readiness'
    : 'not available'

  const systemPrompt = `You are the AI performance coach inside Apex. Your job: analyze training sessions and set precise progression targets that push this athlete toward maximum hypertrophy and mass gain. Output ONLY valid JSON — no markdown, no explanation.`

  const userPrompt = `Analyze this session and set next-session targets.

Athlete:
- ${profile?.name ?? 'Athlete'}, goal: build muscle mass (hypertrophy)
- Current: ${goals?.current_weight_kg ?? '?'}kg → Target: ${goals?.target_weight_kg ?? '?'}kg

WHOOP recovery today: ${recoveryScore !== null ? `${recoveryScore}% (${recoveryLabel})` : 'unknown'}

Session: ${session.session_type ?? 'Training'} — ${session.duration_min ?? '?'}min — ${session.volume_kg ?? '?'}kg total

Exercises logged:
${exerciseStr}

Progression rules — apply strictly:
1. DOUBLE PROGRESSION: athlete hits ALL reps on ALL sets at or above target → increase weight 2.5kg (5kg for squat/deadlift/hip thrust)
2. REPS SHORT: missed any reps → keep same weight, chase same rep target next session
3. NEW EXERCISE (no prior target): set target = their best weight today × their best reps today. Aim for same next session, then progress.
4. HYPERTROPHY RANGES: compounds 6–10 reps / 3–5 sets, isolation 10–15 reps / 3–4 sets
5. RED RECOVERY: be conservative — keep weight the same even if they hit all reps
6. GREEN RECOVERY: push harder — add weight if they hit all reps

For each working exercise:
- Determine target_weight_kg and target_reps for NEXT session
- Count current_sets (working sets done today)
- Write a note (max 8 words) explaining why — e.g. "Hit all reps → +2.5kg", "Missed reps on set 3 — hold weight"
- Set session_type to the muscle split category (push / pull / legs / shoulders / arms / full body)

Write a 2-sentence summary: what they did well (reference real numbers), and the single #1 focus for next session. Be direct, specific, motivating.

Return JSON:
{
  "summary": "...",
  "targets": [
    {
      "exercise_name": "Barbell Bench Press",
      "target_weight_kg": 82.5,
      "target_reps": 8,
      "current_sets": 4,
      "note": "Hit all reps — +2.5kg next session",
      "session_type": "push"
    }
  ]
}`

  let result: AnalyzeResult
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    result = JSON.parse(cleaned) as AnalyzeResult
  } catch (err) {
    console.error('Session analyze error:', err)
    return NextResponse.json({
      summary: 'Session saved. Every rep counts — keep showing up.',
      targets: [],
    })
  }

  // Write progression targets back to exercise_baselines
  for (const target of result.targets ?? []) {
    const currentSets = byName[target.exercise_name] ?? []
    const bestSet = [...currentSets].sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0))[0]

    const payload = {
      user_id: user.id,
      exercise_name: target.exercise_name,
      session_type: target.session_type ?? session.session_type ?? 'training',
      current_weight_kg: bestSet?.weight_kg ?? null,
      current_reps: bestSet?.reps ?? null,
      current_sets: target.current_sets,
      target_weight_kg: target.target_weight_kg,
      target_reps: target.target_reps,
      notes: target.note,
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from('exercise_baselines')
      .select('id')
      .eq('user_id', user.id)
      .eq('exercise_name', target.exercise_name)
      .maybeSingle()

    if (existing) {
      await supabase.from('exercise_baselines').update(payload).eq('id', existing.id)
    } else {
      await supabase.from('exercise_baselines').insert(payload)
    }
  }

  return NextResponse.json(result)
}

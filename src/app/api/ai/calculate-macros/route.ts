import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getFullUserContext } from '@/lib/db'

const anthropic = new Anthropic()

export interface MacroRecommendation {
  calories: number
  protein_g: number
  carbs_g: number
  fats_g: number
  explanation: string
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const userCtx = await getFullUserContext()
  const { profile, goals, lifestyle } = userCtx

  // Fetch 14-day average WHOOP kilojoules for real TDEE signal
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const { data: whoopCycles } = await supabase
    .from('whoop_cycle')
    .select('kilojoule')
    .eq('user_id', user.id)
    .gte('date', fourteenDaysAgo.toISOString().split('T')[0])
    .not('kilojoule', 'is', null)

  const avgKilojoules = whoopCycles && whoopCycles.length > 0
    ? whoopCycles.reduce((s, r) => s + (r.kilojoule ?? 0), 0) / whoopCycles.length
    : null
  const avgCaloriesBurned = avgKilojoules ? Math.round(avgKilojoules / 4.184) : null

  const weightKg = (goals?.current_weight_kg as number) ?? null
  const targetWeightKg = (goals?.target_weight_kg as number) ?? null
  const heightCm = (profile?.height_cm as number) ?? null
  const age = (profile?.age as number) ?? null
  const gender = (profile?.gender as string) ?? 'male'
  const bodyFatPct = (goals?.body_fat_pct as number) ?? null
  const dietType = (lifestyle?.diet_type as string) ?? null

  // Compute Mifflin-St Jeor BMR if we have the data
  let bmr: number | null = null
  if (weightKg && heightCm && age) {
    if (gender === 'female') {
      bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161)
    } else {
      bmr = Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5)
    }
  }

  const goalDirection = weightKg && targetWeightKg
    ? targetWeightKg < weightKg ? 'cut' : targetWeightKg > weightKg ? 'bulk' : 'maintain'
    : 'maintain'

  const prompt = `You are a sports nutritionist. Calculate personalized daily macro targets for this person.

BIOMETRICS:
- Weight: ${weightKg ? `${weightKg} kg` : 'unknown'}
- Target weight: ${targetWeightKg ? `${targetWeightKg} kg` : 'unknown'}
- Height: ${heightCm ? `${heightCm} cm` : 'unknown'}
- Age: ${age ?? 'unknown'}
- Gender: ${gender}
- Body fat: ${bodyFatPct ? `${bodyFatPct}%` : 'unknown'}
- Calculated BMR (Mifflin-St Jeor): ${bmr ? `${bmr} kcal` : 'insufficient data'}

ACTIVITY (real WHOOP data, last 14 days):
- Average daily energy burn: ${avgCaloriesBurned ? `${avgCaloriesBurned} kcal/day (from ${whoopCycles?.length} days of data)` : 'no WHOOP data available'}

GOAL:
- Direction: ${goalDirection} (${goalDirection === 'cut' ? `lose ${Math.round((weightKg ?? 0) - (targetWeightKg ?? 0))} kg` : goalDirection === 'bulk' ? `gain ${Math.round((targetWeightKg ?? 0) - (weightKg ?? 0))} kg` : 'maintain current weight'})
- Diet type: ${dietType ?? 'not specified'}

RULES:
- If WHOOP data is available, use that as the TDEE base (it is more accurate than an activity multiplier)
- If no WHOOP data, estimate TDEE from BMR × a moderate multiplier (1.5–1.7 for someone who trains regularly)
- For a cut: subtract 300–500 kcal/day from TDEE
- For a bulk: add 200–350 kcal/day to TDEE
- Protein: 2.0–2.4 g/kg bodyweight (lean mass if body fat known), higher end for cuts
- Fats: minimum 0.8 g/kg bodyweight, roughly 25–35% of calories
- Carbs: remaining calories after protein and fat are set
- Round all values to nearest 5

Return ONLY valid JSON, no markdown:
{
  "calories": <number>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fats_g": <number>,
  "explanation": "<2–3 sentences: what you used to calculate this and why, mention WHOOP data or BMR as appropriate>"
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    const result = JSON.parse(raw) as MacroRecommendation
    return Response.json(result)
  } catch (err) {
    console.error('[calculate-macros] failed:', err)
    return Response.json({ error: 'Failed to calculate macros' }, { status: 500 })
  }
}

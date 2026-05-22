import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getFullUserContext, getUserGoals } from '@/lib/db'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const anthropic = new Anthropic()

export interface MealPlanItem {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  name: string
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fats_g: number
  prep_note: string
}

export interface MealPlan {
  date: string
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fats_g: number
  meals: MealPlanItem[]
  already_logged_calories?: number
  already_logged_protein_g?: number
}

interface LoggedMeal {
  meal_type: string
  name: string
  calories: number
  protein_g: number
  carbs_g: number
  fats_g: number
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!await checkRateLimit(`${user.id}:meal-plan`, 5, 60 * 60 * 1000)) return rateLimitResponse()

  const body = await request.json() as {
    is_training_day?: boolean
    already_logged?: LoggedMeal[]
    current_hour?: number
  }
  const isTrainingDay = body.is_training_day ?? false
  const alreadyLogged: LoggedMeal[] = body.already_logged ?? []
  const currentHour: number = body.current_hour ?? new Date().getHours()

  const [userCtx, goals] = await Promise.all([
    getFullUserContext(),
    getUserGoals(),
  ])

  const calTarget = (goals?.daily_calorie_target as number) ?? 2100
  const proteinTarget = (goals?.daily_protein_target_g as number) ?? 140
  const dietType = (userCtx.lifestyle?.diet_type as string) ?? 'omnivore'
  const restrictions = (userCtx.lifestyle?.dietary_restrictions as string[]) ?? []
  const dislikes = (userCtx.lifestyle?.dislikes as string[]) ?? []
  const location = (userCtx.profile?.location as string) ?? 'Dubai, UAE'

  // Pull richer nutrition preferences from onboarding
  const nutritionExt = (userCtx.onboarding?.nutrition_ext ?? {}) as Record<string, unknown>
  const enjoysCooking = (nutritionExt.enjoys_cooking as number) ?? 3
  const proteinSources = (nutritionExt.protein_sources as string[]) ?? []
  const cuisines = (nutritionExt.cuisine_list as string[]) ?? []
  const nutritionWeaknesses = (nutritionExt.weaknesses as string[]) ?? []
  const onboardingDislikes = (nutritionExt.dislikes_list as string[]) ?? []

  // Merge dislikes from both sources
  const allDislikes = [...new Set([...dislikes, ...onboardingDislikes])]

  // User body context
  const age = (userCtx.profile?.age as number) ?? null
  const gender = (userCtx.profile?.gender as string) ?? null
  const currentWeight = (goals?.current_weight_kg as number) ?? null
  const targetWeight = (goals?.target_weight_kg as number) ?? null
  const bodyFat = (goals?.body_fat_pct as number) ?? null

  // Derive goal direction
  const weightDelta = currentWeight && targetWeight ? targetWeight - currentWeight : null
  const goalContext = weightDelta !== null
    ? weightDelta < -1 ? 'cutting — slight caloric deficit, keep protein high'
      : weightDelta > 1 ? 'bulking — slight caloric surplus, prioritise protein and carbs'
      : 'maintaining — hit targets precisely'
    : null

  const carbAdjust = isTrainingDay ? 'slightly higher carbs for fuel and recovery' : 'moderate carbs'

  type BM = { name: string; value: string; unit: string; status: string; note?: string }
  const lab = userCtx.latestLab?.structured_data as { biomarkers?: BM[] } | null
  const labOutOfRange = lab?.biomarkers?.filter((b: BM) => b.status === 'out_of_range') ?? []
  const labSufficient = lab?.biomarkers?.filter((b: BM) => b.status === 'sufficient') ?? []
  const labNutritionContext = [...labOutOfRange, ...labSufficient].length > 0
    ? `\n- Blood work flags to address via diet: ${[...labOutOfRange, ...labSufficient].map((b: BM) => `${b.name} ${b.value}${b.unit}${b.note ? ` (${b.note})` : ''}`).join('; ')}`
    : ''

  // Calculate what's already been consumed
  const loggedCals = alreadyLogged.reduce((s, m) => s + (m.calories ?? 0), 0)
  const loggedProtein = alreadyLogged.reduce((s, m) => s + (m.protein_g ?? 0), 0)
  const loggedCarbs = alreadyLogged.reduce((s, m) => s + (m.carbs_g ?? 0), 0)
  const loggedFats = alreadyLogged.reduce((s, m) => s + (m.fats_g ?? 0), 0)
  const remainingCals = Math.max(0, calTarget - loggedCals)
  const remainingProtein = Math.max(0, proteinTarget - loggedProtein)

  // Determine which meal types are still ahead based on time
  const loggedTypes = new Set(alreadyLogged.map(m => m.meal_type))
  const remainingMealTypes: string[] = []
  if (!loggedTypes.has('breakfast') && currentHour < 11) remainingMealTypes.push('breakfast')
  if (!loggedTypes.has('lunch') && currentHour < 15) remainingMealTypes.push('lunch')
  if (!loggedTypes.has('dinner') && currentHour < 21) remainingMealTypes.push('dinner')
  if (!loggedTypes.has('snack') && currentHour < 22) remainingMealTypes.push('snack')

  // If nothing remains, return an empty plan with full context
  if (remainingMealTypes.length === 0 || remainingCals <= 50) {
    return Response.json({
      date: new Date().toISOString().split('T')[0],
      total_calories: loggedCals,
      total_protein_g: loggedProtein,
      total_carbs_g: loggedCarbs,
      total_fats_g: loggedFats,
      meals: [],
      already_logged_calories: loggedCals,
      already_logged_protein_g: loggedProtein,
    } satisfies MealPlan)
  }

  const alreadyEatenSection = alreadyLogged.length > 0
    ? `\nALREADY EATEN TODAY:\n${alreadyLogged.map(m => `- ${m.meal_type}: ${m.name} (${m.calories} kcal, ${m.protein_g}g protein)`).join('\n')}\nConsumed so far: ${loggedCals} kcal, ${loggedProtein}g protein`
    : ''

  const cookingNote = enjoysCooking <= 2
    ? 'Hates cooking — all meals must be no-cook or max 5 min prep (delivery, ready-made, grab-and-go strongly preferred)'
    : enjoysCooking <= 3
    ? 'Low cooking motivation — keep prep under 10 min, simple recipes only'
    : enjoysCooking <= 4
    ? 'Willing to cook — moderate prep OK (up to 20 min)'
    : 'Enjoys cooking — elaborate meals fine, can use multiple ingredients'

  const prompt = `Generate a meal plan for the REST OF TODAY for this person. Return ONLY valid JSON, no markdown, no extra text.

PERSON:
- Age: ${age ?? 'unknown'}, Gender: ${gender ?? 'unknown'}${currentWeight ? `\n- Weight: ${currentWeight}kg` : ''}${bodyFat ? ` | Body fat: ${bodyFat}%` : ''}${goalContext ? `\n- Goal direction: ${goalContext}` : ''}
- Diet type: ${dietType}${restrictions.length ? `\n- Hard restrictions (never include): ${restrictions.join(', ')}` : ''}${allDislikes.length ? `\n- Dislikes (avoid): ${allDislikes.join(', ')}` : ''}${proteinSources.length ? `\n- Preferred protein sources: ${proteinSources.join(', ')}` : ''}${cuisines.length ? `\n- Preferred cuisines: ${cuisines.join(', ')}` : ''}${nutritionWeaknesses.length ? `\n- Nutritional weaknesses to address: ${nutritionWeaknesses.join(', ')}` : ''}
- Location: ${location} (easily available foods only — match local cuisine and store availability)
- Cooking preference: ${cookingNote}
- Today: ${isTrainingDay ? 'Training day' : 'Rest day'} — use ${carbAdjust}${labNutritionContext}
- Current time: ${currentHour}:00${alreadyEatenSection}

REMAINING TARGETS (for the rest of today only):
- Remaining calories: ${remainingCals} kcal
- Remaining protein: ${remainingProtein}g
- Meals still needed: ${remainingMealTypes.join(', ')}

RULES:
- Only generate meals for: ${remainingMealTypes.join(', ')}
- Do NOT repeat meals that have already been eaten
- Strongly favour preferred cuisines and protein sources
- Never include hard-restricted or disliked foods
- Macros must add up to roughly the remaining targets (within ±100 kcal, ±10g protein)
- Each meal must be realistic and available in ${location.split(',')[0]}
- prep_note must be specific (e.g. "5 min", "no cook", "delivery ok", "microwave 2 min")

Return this exact JSON shape (only include the remaining meals, not already-eaten ones):
{
  "date": "${new Date().toISOString().split('T')[0]}",
  "total_calories": <sum of remaining meals only>,
  "total_protein_g": <sum of remaining meals only>,
  "total_carbs_g": <sum of remaining meals only>,
  "total_fats_g": <sum of remaining meals only>,
  "meals": [
    {
      "meal_type": "${remainingMealTypes[0]}",
      "name": "<meal name>",
      "description": "<1 sentence: what it is and portion size>",
      "calories": <number>,
      "protein_g": <number>,
      "carbs_g": <number>,
      "fats_g": <number>,
      "prep_note": "<e.g. 5 min>"
    }
  ]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim()

    const plan = JSON.parse(raw) as MealPlan
    plan.already_logged_calories = loggedCals
    plan.already_logged_protein_g = loggedProtein
    return Response.json(plan)
  } catch (err) {
    console.error('[meal-plan] failed:', err)
    return Response.json({ error: 'Failed to generate meal plan' }, { status: 500 })
  }
}

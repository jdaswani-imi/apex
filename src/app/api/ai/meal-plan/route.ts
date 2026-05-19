import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getFullUserContext, getUserGoals } from '@/lib/db'

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
  const dietType = (userCtx.lifestyle?.diet_type as string) ?? 'vegetarian'
  const restrictions = (userCtx.lifestyle?.dietary_restrictions as string[]) ?? []
  const dislikes = (userCtx.lifestyle?.dislikes as string[]) ?? []
  const location = (userCtx.profile?.location as string) ?? 'Dubai, UAE'

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

  const prompt = `Generate a meal plan for the REST OF TODAY for this person. Return ONLY valid JSON, no markdown, no extra text.

PERSON:
- Diet: ${dietType} (eggs and dairy OK)${restrictions.length ? `\n- Restrictions: ${restrictions.join(', ')}` : ''}${dislikes.length ? `\n- Dislikes: ${dislikes.join(', ')}` : ''}
- Location: ${location} (easily available foods only)
- Hates cooking — all meals must be minimal effort (max 10 min prep, or no-cook)
- Today: ${isTrainingDay ? 'Training day' : 'Rest day'} — use ${carbAdjust}${labNutritionContext}
- Current time: ${currentHour}:00${alreadyEatenSection}

REMAINING TARGETS (for the rest of today only):
- Remaining calories: ${remainingCals} kcal
- Remaining protein: ${remainingProtein}g
- Meals still needed: ${remainingMealTypes.join(', ')}

RULES:
- Only generate meals for: ${remainingMealTypes.join(', ')}
- Do NOT repeat meals that have already been eaten
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

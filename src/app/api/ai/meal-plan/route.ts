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
  prep_note: string // e.g. "ready in 5 min" or "no cook"
}

export interface MealPlan {
  date: string
  total_calories: number
  total_protein_g: number
  total_carbs_g: number
  total_fats_g: number
  meals: MealPlanItem[]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const body = await request.json() as { is_training_day?: boolean }
  const isTrainingDay = body.is_training_day ?? false

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

  // On training days, boost carbs; on rest days, keep lower
  const carbAdjust = isTrainingDay ? 'slightly higher carbs for fuel and recovery' : 'moderate carbs'

  type BM = { name: string; value: string; unit: string; status: string; note?: string }
  const lab = userCtx.latestLab?.structured_data as { biomarkers?: BM[] } | null
  const labOutOfRange = lab?.biomarkers?.filter((b: BM) => b.status === 'out_of_range') ?? []
  const labSufficient = lab?.biomarkers?.filter((b: BM) => b.status === 'sufficient') ?? []
  const labNutritionContext = [...labOutOfRange, ...labSufficient].length > 0
    ? `\n- Blood work flags to address via diet: ${[...labOutOfRange, ...labSufficient].map((b: BM) => `${b.name} ${b.value}${b.unit}${b.note ? ` (${b.note})` : ''}`).join('; ')}`
    : ''

  const prompt = `Generate a full day meal plan for this person. Return ONLY valid JSON, no markdown, no extra text.

PERSON:
- Diet: ${dietType} (eggs and dairy OK)${restrictions.length ? `\n- Restrictions: ${restrictions.join(', ')}` : ''}${dislikes.length ? `\n- Dislikes: ${dislikes.join(', ')}` : ''}
- Location: ${location} (easily available foods only)
- Hates cooking — all meals must be minimal effort (max 10 min prep, or no-cook)
- Today: ${isTrainingDay ? 'Training day' : 'Rest day'} — use ${carbAdjust}${labNutritionContext}

TARGETS:
- Calories: ${calTarget} kcal
- Protein: ${proteinTarget}g
- Macros: protein-forward, moderate carbs, moderate fat

RULES:
- 4 meals: breakfast, lunch, dinner, snack
- Each meal must be realistic, available in a grocery store or restaurant in ${location.split(',')[0]}
- Provide accurate macros per meal
- prep_note must be specific (e.g. "5 min", "no cook", "delivery ok", "microwave 2 min")
- Total macros must hit the targets within ±100 kcal and ±10g protein

Return this exact JSON shape:
{
  "date": "${new Date().toISOString().split('T')[0]}",
  "total_calories": <number>,
  "total_protein_g": <number>,
  "total_carbs_g": <number>,
  "total_fats_g": <number>,
  "meals": [
    {
      "meal_type": "breakfast",
      "name": "<meal name>",
      "description": "<1 sentence: what it is and portion size>",
      "calories": <number>,
      "protein_g": <number>,
      "carbs_g": <number>,
      "fats_g": <number>,
      "prep_note": "<e.g. 5 min>"
    },
    ... (lunch, dinner, snack)
  ]
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    const plan = JSON.parse(raw) as MealPlan
    return Response.json(plan)
  } catch {
    return Response.json({ error: 'Failed to generate meal plan' }, { status: 500 })
  }
}

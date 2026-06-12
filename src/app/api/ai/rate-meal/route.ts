import { NextResponse } from 'next/server'
import { MODEL_HAIKU } from '@/lib/ai/models'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { getUserLifestyle, getUserGoals } from '@/lib/db'
import { getCachedAI, setCachedAI } from '@/lib/ai-cache'

const anthropic = new Anthropic()

interface MealContextItem {
  name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fats_g: number | null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkRateLimit(`${user.id}:rate-meal`, 60, 60 * 60 * 1000)) return rateLimitResponse()

  const body = await request.json() as {
    name: string
    meal_type?: string
    calories?: number | null
    protein_g?: number | null
    carbs_g?: number | null
    fats_g?: number | null
    meal_context?: MealContextItem[]
    force?: boolean
  }

  const { name, meal_type, calories, protein_g, carbs_g, fats_g, meal_context, force } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

  // Cache by meal fingerprint — ratings are stable for the same item + macros + user
  const cacheKey = `ai:rate-meal:${user.id}:${name.trim().toLowerCase()}:${calories ?? 0}:${protein_g ?? 0}`
  if (!force) {
    const cachedRating = await getCachedAI<{ rating: number; suggestions: string }>(cacheKey)
    if (cachedRating) return NextResponse.json(cachedRating)
  }

  // Fetch user profile in parallel with no extra latency
  const [lifestyle, goals] = await Promise.all([getUserLifestyle(), getUserGoals()])

  // User context block
  const userLines: string[] = []
  if (lifestyle?.diet_type) userLines.push(`Diet: ${lifestyle.diet_type}`)
  if (lifestyle?.dietary_restrictions) userLines.push(`Restrictions: ${lifestyle.dietary_restrictions}`)
  if ((lifestyle?.dislikes as string[] | null)?.length) {
    userLines.push(`Dislikes/avoid: ${(lifestyle.dislikes as string[]).join(', ')}`)
  }
  if (goals?.daily_protein_target_g) userLines.push(`Protein target: ${goals.daily_protein_target_g}g/day`)
  if (goals?.daily_calorie_target) userLines.push(`Calorie target: ${goals.daily_calorie_target} kcal/day`)

  // Meal context block — what else is in this same meal
  let mealContextBlock = ''
  if (Array.isArray(meal_context) && meal_context.length > 0) {
    const lines = meal_context.map(m => {
      const info = [
        m.calories != null && `${m.calories} kcal`,
        m.protein_g != null && `${m.protein_g}g P`,
        m.carbs_g != null && `${m.carbs_g}g C`,
        m.fats_g != null && `${m.fats_g}g F`,
      ].filter(Boolean).join(', ')
      return `  - ${m.name}${info ? ` (${info})` : ''}`
    })
    mealContextBlock = `\nOther items also logged in this ${meal_type ?? 'meal'}:\n${lines.join('\n')}`
  }

  const macrosLine = [
    calories != null && `${calories} kcal`,
    protein_g != null && `${protein_g}g protein`,
    carbs_g != null && `${carbs_g}g carbs`,
    fats_g != null && `${fats_g}g fat`,
  ].filter(Boolean).join(', ')

  const prompt = `You are a sports nutritionist rating an individual meal item for a specific athlete.

USER PROFILE:
${userLines.length ? userLines.join('\n') : 'Unknown'}

ITEM BEING RATED:
"${name.trim()}"${meal_type ? ` (${meal_type})` : ''}${macrosLine ? `\nMacros: ${macrosLine}` : ''}${mealContextBlock}

RULES:
- Rate this item 0–100 on nutritional quality: whole vs processed food, macro contribution, micronutrient value, fit for an active athlete
- Consider the full meal context — do NOT suggest adding something already provided by other items in this meal
- NEVER suggest foods the user dislikes or that conflict with their diet type
- Give exactly one short, actionable suggestion (max 12 words) that makes practical sense for this user
- Supplements, vitamins, probiotics, and plain coffee are health-neutral items — rate them 75 and note they are a supplement

Rating guide: 85–100 excellent · 70–84 good · 50–69 average · 30–49 below average · 0–29 poor

Respond with JSON only (no markdown, no explanation):
{"rating": <integer 0-100>, "suggestions": "<suggestion>"}`

  const message = await anthropic.messages.create({
    model: MODEL_HAIKU,
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
  try {
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?|\n?```$/g, '').trim())
    const result = {
      rating: Math.min(100, Math.max(0, Math.round(Number(parsed.rating)))),
      suggestions: String(parsed.suggestions ?? '').trim(),
    }
    await setCachedAI(cacheKey, result, 86400)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Parse error' }, { status: 500 })
  }
}

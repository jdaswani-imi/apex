import Anthropic from '@anthropic-ai/sdk'
import { MODEL_SONNET } from '@/lib/ai/models'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const anthropic = new Anthropic()

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const SUPPORTED: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function normalizeMediaType(type: string): SupportedMediaType {
  if (type === 'image/jpg') return 'image/jpeg'
  if (SUPPORTED.includes(type as SupportedMediaType)) return type as SupportedMediaType
  return 'image/jpeg'
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkRateLimit(`${user.id}:analyze-food`, 30, 60 * 60 * 1000)) return rateLimitResponse()

  const formData = await request.formData()
  const files = formData.getAll('image') as File[]
  const description = (formData.get('description') as string | null)?.trim() || null

  if (files.length === 0) return Response.json({ error: 'No image provided' }, { status: 400 })

  const imageBlocks = await Promise.all(
    files.map(async (file) => {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      return {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: normalizeMediaType(file.type), data: base64 },
      }
    })
  )

  const userNote = description ? `\n\nUser note: "${description}"` : ''
  const photoCount = files.length > 1 ? `these ${files.length} food photos` : 'this food photo'

  try {
    const response = await anthropic.messages.create({
      model: MODEL_SONNET,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          ...imageBlocks,
          {
            type: 'text',
            text: `Analyze ${photoCount} and estimate the combined nutritional content for this meal. Return ONLY valid JSON, no markdown.${userNote}

JSON shape:
{
  "name": "<concise meal name, e.g. 'Grilled chicken with rice'>",
  "calories": <integer>,
  "protein_g": <number>,
  "carbs_g": <number>,
  "fats_g": <number>,
  "confidence": "low" | "medium" | "high",
  "notes": "<brief note on portion assumptions>"
}

Treat all photos as parts of the same meal and return a single combined estimate. Base estimates on typical serving sizes visible. If no food is visible in any photo, return {"error": "No food detected"}.`,
          },
        ],
      }],
    })

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    // Strip markdown code fences if Claude wrapped the JSON
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

    const result = JSON.parse(cleaned)
    if (result.error) return Response.json({ error: result.error }, { status: 422 })
    return Response.json(result)
  } catch (err) {
    console.error('[analyze-food]', err)
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: message }, { status: 500 })
  }
}

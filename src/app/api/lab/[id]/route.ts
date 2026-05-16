import { createClient } from '@/lib/supabase/server'
import { getFullUserContext } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// Robustly extract the first complete JSON object from a string
function extractJson(text: string): Record<string, unknown> {
  // Strip markdown fences first
  const stripped = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  // Find outermost { ... }
  const start = stripped.indexOf('{')
  const end = stripped.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) throw new Error('No JSON object found')
  return JSON.parse(stripped.slice(start, end + 1))
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('lab_reports')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return new Response('Not found', { status: 404 })
  return Response.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const { error } = await supabase
    .from('lab_reports')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const { data: report, error: fetchErr } = await supabase
    .from('lab_reports')
    .select('analysis, report_type')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (fetchErr || !report?.analysis) return new Response('Not found', { status: 404 })

  const userCtx = await getFullUserContext()
  const { profile, goals, lifestyle } = userCtx

  const userSummary = [
    `Age: ${profile?.age ?? 'unknown'}, Sex: ${profile?.gender ?? 'unknown'}`,
    `Height: ${profile?.height_cm ? `${profile.height_cm}cm` : 'unknown'}, Weight: ${goals?.current_weight_kg ? `${goals.current_weight_kg}kg` : 'unknown'}`,
    `Body fat: ${goals?.body_fat_pct ? `~${goals.body_fat_pct}%` : 'unknown'}`,
    `Diet: ${lifestyle?.diet_type ?? 'unknown'}, Activity: active (regular gym training)`,
    `Location: ${profile?.location ?? 'unknown'}`,
  ].join('\n')

  const prompt = `Re-structure the lab report analysis below into the required JSON schema. The raw analysis may be incomplete or truncated — extract and re-structure every biomarker you can find in it; do not refuse or mention the truncation.

USER PROFILE:
${userSummary}

RAW ANALYSIS:
${report.analysis}

Output the JSON object directly, starting with { and ending with }. No preamble, no markdown, no explanation.

Schema:
{
  "summary": "2-3 sentence assessment personalised to this user",
  "overall_status": "good" | "attention" | "action_required",
  "report_type": "${report.report_type ?? 'other'}",
  "biomarkers": [
    {
      "panel": "panel name as seen on the report",
      "name": "full biomarker name",
      "value": "measured value as string",
      "value_numeric": 0.0,
      "unit": "unit string",
      "reference_range": "e.g. 4.5–11.0 or <100 or >40",
      "range_min": 0.0,
      "range_max": 0.0,
      "status": "optimal" | "sufficient" | "out_of_range",
      "note": "1 sentence if not optimal, else empty string"
    }
  ],
  "recommendations": ["up to 5 personalised recommendations"],
  "disclaimer": "This analysis is AI-generated and is not a substitute for professional medical advice. Always consult your doctor."
}

Status: optimal = ideal zone, sufficient = in reference range but not ideal, out_of_range = outside reference range.
range_min/range_max: always numeric. Upper-bound only (<N): range_min=0, range_max=N. Lower-bound only (>N): range_min=N, range_max=N*2.5.
Extract every single biomarker. Adjust optimal ranges for this user's profile where relevant.`

  let structured: Record<string, unknown>
  try {
    // Prefill assistant turn with '{' to guarantee JSON output starts immediately
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [
        { role: 'user', content: prompt },
      ],
    })

    if (response.stop_reason === 'max_tokens') {
      console.error('Re-analyse: response was truncated (max_tokens hit)')
      return Response.json({ error: 'Report too large to process in one pass. Try again or contact support.' }, { status: 500 })
    }

    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
    console.log('Re-analyse raw response (first 500 chars):', raw.slice(0, 500))
    structured = extractJson(raw)
  } catch (err) {
    console.error('Re-analyse error:', err)
    return Response.json({ error: 'Failed to re-analyse. Please try again.' }, { status: 500 })
  }

  const summary = (structured.summary as string | undefined) ?? ''

  const { data: updated, error: updateErr } = await supabase
    .from('lab_reports')
    .update({ structured_data: structured, summary })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })
  return Response.json(updated)
}

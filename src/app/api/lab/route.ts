import { createClient } from '@/lib/supabase/server'
import { getFullUserContext } from '@/lib/db'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data } = await supabase
    .from('lab_reports')
    .select('id, filename, report_type, report_date, summary, structured_data, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return Response.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const reportDate = formData.get('report_date') as string | null

  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return Response.json({ error: 'File too large (max 20MB)' }, { status: 400 })

  const mime = file.type
  const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mime)
  const isPdf = mime === 'application/pdf'
  if (!isImage && !isPdf) return Response.json({ error: 'Only PDF or image files are supported' }, { status: 400 })

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  const userCtx = await getFullUserContext()
  const { profile, goals, lifestyle } = userCtx

  const userSummary = [
    `Age: ${profile?.age ?? 'unknown'}, Sex: ${profile?.gender ?? 'unknown'}`,
    `Height: ${profile?.height_cm ? `${profile.height_cm}cm` : 'unknown'}, Weight: ${goals?.current_weight_kg ? `${goals.current_weight_kg}kg` : 'unknown'}`,
    `Body fat: ${goals?.body_fat_pct ? `~${goals.body_fat_pct}%` : 'unknown'}`,
    `Diet: ${lifestyle?.diet_type ?? 'unknown'}, Activity: active (regular gym training)`,
    `Location: ${profile?.location ?? 'unknown'}`,
  ].join('\n')

  const prompt = `Analyse this lab report document.

USER PROFILE:
${userSummary}

Return ONLY a valid JSON object — no markdown fences, no text outside the JSON. Use this exact schema:

{
  "summary": "2-3 sentence overall assessment personalised to this user",
  "overall_status": "good" | "attention" | "action_required",
  "report_type": "blood" | "urine" | "other",
  "biomarkers": [
    {
      "panel": "Panel name as it appears on the report (e.g. Complete Blood Count, Lipid Panel, Thyroid Function)",
      "name": "Full biomarker name",
      "value": "measured value as string",
      "value_numeric": 0.0,
      "unit": "unit string",
      "reference_range": "human-readable range e.g. 4.5–11.0 or <100 or >40",
      "range_min": 0.0,
      "range_max": 0.0,
      "status": "optimal" | "sufficient" | "out_of_range",
      "note": "1 sentence if not optimal, else empty string"
    }
  ],
  "recommendations": ["actionable recommendation 1", "...up to 5 total"],
  "disclaimer": "This analysis is AI-generated and is not a substitute for professional medical advice. Always consult your doctor."
}

Status definitions:
- optimal: value sits in the ideal/optimal zone, not just within the standard lab reference range
- sufficient: value is within the standard reference range but not in the optimal zone
- out_of_range: value is outside the standard reference range

range_min / range_max rules:
- For two-sided ranges (e.g. 4.5–11.0): use exact values
- For upper-bound only (<100): range_min = 0, range_max = the limit
- For lower-bound only (>40): range_min = the limit, range_max = range_min * 2.5
- Always provide numeric values — never null

Rules:
- Extract every single biomarker visible in the document
- Adjust optimal ranges for the user's age, sex, and activity level where clinically relevant
- Be direct and specific — never generic advice`

  const contentBlock: Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mime as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } }

  let rawText: string
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      messages: [
        { role: 'user', content: [contentBlock, { type: 'text', text: prompt }] },
      ],
    })
    if (response.stop_reason === 'max_tokens') {
      console.error('Lab upload: response truncated (max_tokens hit)')
      return Response.json({ error: 'Lab report is too large to process. Try splitting it into smaller sections.' }, { status: 400 })
    }
    rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')
  } catch (err) {
    console.error('Lab upload error:', err instanceof Error ? err.message : err)
    return Response.json({ error: 'Failed to analyse the document. Please try again.' }, { status: 500 })
  }

  let structured: Record<string, unknown> | null = null
  try {
    const start = rawText.indexOf('{')
    const end = rawText.lastIndexOf('}')
    if (start !== -1 && end > start) structured = JSON.parse(rawText.slice(start, end + 1))
  } catch {
    // fallback: store raw text only
  }

  const summary = (structured?.summary as string | undefined)
    ?? rawText.slice(0, 200).replace(/[{}"]/g, '')
  const reportType = (structured?.report_type as string | undefined) ?? 'other'

  const { data: report, error } = await supabase
    .from('lab_reports')
    .insert({
      user_id: user.id,
      filename: file.name,
      report_type: reportType,
      report_date: reportDate || null,
      analysis: rawText,
      summary,
      structured_data: structured,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(report)
}

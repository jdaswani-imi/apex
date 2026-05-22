import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getTodayContext, getFullUserContext, getCoachingMemory, saveCoachingMemory, deleteCoachingMemory } from '@/lib/db'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const anthropic = new Anthropic()

export interface ChatAction {
  type: 'log_meal' | 'log_workout' | 'log_rest_day' | 'log_weight' | 'log_steps' | 'mark_supplements_taken'
  label: string
  payload: Record<string, unknown>
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'log_food',
    description:
      "Log a food or meal to the user's food log for today. Use ONLY for actual food and drinks consumed as part of a meal. Do NOT use this for supplements, vitamins, minerals, creatine, protein powder, or any item from the user's supplement stack — use mark_supplements_taken for those instead.",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the food item' },
        meal_type: {
          type: 'string',
          enum: ['breakfast', 'lunch', 'dinner', 'snack'],
          description: 'Which meal this belongs to',
        },
        calories: { type: 'number', description: 'Total calories (kcal)' },
        protein_g: { type: 'number', description: 'Protein in grams' },
        carbs_g: { type: 'number', description: 'Carbohydrates in grams' },
        fats_g: { type: 'number', description: 'Fats in grams' },
      },
      required: ['name', 'meal_type'],
    },
  },
  {
    name: 'update_daily_metric',
    description:
      "Update a specific metric in today's daily log — weight, steps, or macro totals.",
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['weight_kg', 'steps', 'calories', 'protein_g', 'carbs_g', 'fats_g'],
          description: 'Which metric to update',
        },
        value: { type: 'number', description: 'The new value' },
      },
      required: ['metric', 'value'],
    },
  },
  {
    name: 'get_today_nutrition',
    description:
      "Fetch all food items the user has logged today so you can see what they've eaten and give accurate advice.",
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_training_history',
    description:
      'Fetch recent training sessions with exercises, sets, reps, and weights to analyse performance trends or plan next session.',
    input_schema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'How many days back to look (default 7, max 30)',
        },
      },
    },
  },
  {
    name: 'mark_supplements_taken',
    description:
      "Mark one or more supplements as taken today. Use this whenever the user mentions taking, having, or logging a supplement, vitamin, mineral, creatine, protein powder, or any item from their supplement stack. This is the ONLY correct tool for supplements — never use log_food for them.",
    input_schema: {
      type: 'object',
      properties: {
        names: {
          type: 'array',
          items: { type: 'string' },
          description: "Names of the supplements to mark as taken. Match against the user's known supplement stack.",
        },
      },
      required: ['names'],
    },
  },
  {
    name: 'log_feeling',
    description:
      "Save or update how the user is feeling right now — recovery, sleep quality, sleep hours felt, and readiness for training. Use whenever the user describes how they feel, mentions being tired/sore/stressed, or checks in on their energy. Scores are 1-5 (1=very poor, 5=excellent). Only set the fields the user actually mentioned.",
    input_schema: {
      type: 'object',
      properties: {
        feeling_recovery: { type: 'number', description: '1-5: how recovered they feel overall' },
        feeling_sleep_quality: { type: 'number', description: '1-5: how well they slept' },
        feeling_sleep_hours: { type: 'number', description: '1-5: whether they felt they got enough sleep hours' },
        feeling_strain: { type: 'number', description: '1-5: readiness for training/strain today' },
        notes: { type: 'string', description: 'Optional free-text note to attach to today\'s log (e.g. "stressful day at work", "knee feels off")' },
      },
    },
  },
  {
    name: 'save_coaching_note',
    description:
      "Save a persistent coaching insight, commitment, or accountability item that should be remembered across future sessions. Use when the user commits to something (\"I'll hit protein every day this week\"), reveals a pattern worth tracking (\"always skips supplements on Sundays\"), or after a key insight from the conversation. Key should be short and specific (e.g. \"protein_commitment_may\", \"sunday_supplement_issue\"). Category: commitment, pattern, insight, goal, or concern.",
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Short unique identifier for this note (snake_case, max 40 chars)' },
        content: { type: 'string', description: 'The note content — what was agreed, observed, or flagged' },
        category: {
          type: 'string',
          enum: ['commitment', 'pattern', 'insight', 'goal', 'concern'],
          description: 'Type of coaching note',
        },
      },
      required: ['key', 'content', 'category'],
    },
  },
  {
    name: 'get_coaching_notes',
    description:
      "Retrieve all saved coaching notes to review past commitments, patterns, and insights. Use when the user asks what you remember, references a past conversation, or when you need context on their history before giving advice.",
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'delete_coaching_note',
    description:
      "Delete a coaching note that is no longer relevant — e.g. a commitment has been fulfilled, a concern resolved, or the user asks to clear it.",
    input_schema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'The key of the note to delete' },
      },
      required: ['key'],
    },
  },
  {
    name: 'log_rest_day',
    description:
      "Log today as a rest day in the training record. Use when the user says they're resting, can't train, are too sore, have low recovery, have a sport commitment that replaces the gym, or are taking a planned off day. IMPORTANT: a rest day does NOT advance the training cycle — the same workout that was planned for today will be waiting for them next training day. Always tell the user what that next workout is after logging.",
    input_schema: {
      type: 'object',
      properties: {
        notes: {
          type: 'string',
          description: 'Optional reason for rest (e.g. "sore", "recovery day", "cricket match", "travel")',
        },
      },
    },
  },
  {
    name: 'suggest_actions',
    description:
      'Attach 1–3 one-tap action buttons to your response when the conversation surfaces a specific, ready-to-log item — e.g. after discussing a meal with known macros, confirming a workout, mentioning a rest day, reading out a weight, or checking in on supplements. Do NOT suggest if no concrete loggable data was discussed. Labels must be short and specific (e.g. "Log chicken & rice as lunch", "Log push day", "Mark rest day").',
    input_schema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['log_meal', 'log_workout', 'log_rest_day', 'log_weight', 'log_steps', 'mark_supplements_taken'],
              },
              label: { type: 'string', description: 'Short button label visible to the user' },
              payload: {
                type: 'object',
                description: 'Pre-filled data. log_meal: {name, meal_type, calories?, protein_g?, carbs_g?, fats_g?}. log_workout: {session_type, duration_min?, notes?}. log_rest_day: {notes?}. log_weight: {weight_kg}. log_steps: {steps}. mark_supplements_taken: {names?}',
              },
            },
            required: ['type', 'label', 'payload'],
          },
        },
      },
      required: ['actions'],
    },
  },
]

async function executeTool(
  name: string,
  input: unknown,
  userId: string,
): Promise<string> {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const inp = input as Record<string, unknown>

  switch (name) {
    case 'log_food': {
      const { data, error } = await supabase
        .from('food_logs')
        .insert({
          user_id: userId,
          date: today,
          name: inp.name,
          meal_type: inp.meal_type ?? 'snack',
          calories: inp.calories ?? null,
          protein_g: inp.protein_g ?? null,
          carbs_g: inp.carbs_g ?? null,
          fats_g: inp.fats_g ?? null,
        })
        .select()
        .single()
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify({ success: true, logged: data })
    }

    case 'update_daily_metric': {
      const metric = inp.metric as string
      const { error } = await supabase
        .from('daily_logs')
        .upsert(
          { user_id: userId, date: today, [metric]: inp.value },
          { onConflict: 'user_id,date' },
        )
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify({ success: true, updated: { [metric]: inp.value } })
    }

    case 'get_today_nutrition': {
      const { data } = await supabase
        .from('food_logs')
        .select('name, meal_type, calories, protein_g, carbs_g, fats_g')
        .eq('user_id', userId)
        .eq('date', today)
        .order('created_at', { ascending: true })
      return JSON.stringify(data ?? [])
    }

    case 'get_training_history': {
      const days = typeof inp.days === 'number' ? Math.min(inp.days, 30) : 7
      const from = new Date()
      from.setDate(from.getDate() - days)
      const { data } = await supabase
        .from('training_sessions')
        .select('date, session_type, duration_min, volume_kg, prs, notes, template_id, finished_at, exercises(name, sets, reps, weight_kg, is_pr, notes)')
        .eq('user_id', userId)
        .gte('date', from.toISOString().split('T')[0])
        .order('date', { ascending: false })
      // Annotate each session so the AI knows whether it advanced the cycle
      const annotated = (data ?? []).map(s => ({
        ...s,
        cycle_advancing: !!s.finished_at && !!s.template_id && !/^rest.?day$/i.test(s.session_type ?? ''),
      }))
      return JSON.stringify(annotated)
    }

    case 'log_feeling': {
      const updates: Record<string, unknown> = {}
      if (typeof inp.feeling_recovery === 'number') updates.feeling_recovery = Math.min(5, Math.max(1, inp.feeling_recovery))
      if (typeof inp.feeling_sleep_quality === 'number') updates.feeling_sleep_quality = Math.min(5, Math.max(1, inp.feeling_sleep_quality))
      if (typeof inp.feeling_sleep_hours === 'number') updates.feeling_sleep_hours = Math.min(5, Math.max(1, inp.feeling_sleep_hours))
      if (typeof inp.feeling_strain === 'number') updates.feeling_strain = Math.min(5, Math.max(1, inp.feeling_strain))
      if (typeof inp.notes === 'string' && inp.notes.trim()) updates.notes = inp.notes.trim()
      if (Object.keys(updates).length === 0) return JSON.stringify({ success: false, error: 'No fields provided' })
      const { error } = await supabase
        .from('daily_logs')
        .upsert({ user_id: userId, date: today, ...updates }, { onConflict: 'user_id,date' })
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify({ success: true, saved: updates })
    }

    case 'save_coaching_note': {
      const result = await saveCoachingMemory(
        String(inp.key ?? ''),
        String(inp.content ?? ''),
        String(inp.category ?? 'general'),
      )
      if (!result) return JSON.stringify({ success: false, error: 'Failed to save' })
      return JSON.stringify({ success: true, saved: result })
    }

    case 'get_coaching_notes': {
      const notes = await getCoachingMemory()
      return JSON.stringify(notes)
    }

    case 'delete_coaching_note': {
      await deleteCoachingMemory(String(inp.key ?? ''))
      return JSON.stringify({ success: true })
    }

    case 'log_rest_day': {
      const { error } = await supabase.from('training_sessions').insert({
        user_id: userId,
        date: today,
        session_type: 'Rest day',
        notes: typeof inp.notes === 'string' ? inp.notes : null,
      })
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify({
        success: true,
        message: 'Rest day logged. The training cycle is unchanged — the same workout will be ready next training day.',
      })
    }

    case 'mark_supplements_taken': {
      const names = inp.names as string[]
      if (!names?.length) return JSON.stringify({ success: false, error: 'No supplement names provided' })
      const results = await Promise.all(
        names.map(name =>
          supabase.from('supplement_logs').upsert(
            { user_id: userId, date: today, supplement_name: name, taken: true },
            { onConflict: 'user_id,date,supplement_name' },
          ),
        ),
      )
      const errors = results.filter(r => r.error).map(r => r.error?.message)
      if (errors.length) return JSON.stringify({ success: false, errors })
      return JSON.stringify({ success: true, marked: names })
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })
  if (!await checkRateLimit(`${user.id}:chat`, 30, 60 * 60 * 1000)) return rateLimitResponse()

  const { messages } = await request.json() as {
    messages: Anthropic.MessageParam[]
  }

  const [ctx, userCtx] = await Promise.all([
    getTodayContext(),
    getFullUserContext(),
  ])
  if (!ctx) return new Response('Unauthorized', { status: 401 })

  const systemPrompt = buildSystemPrompt(ctx, userCtx)

  const MAX_HISTORY = 20
  const enc = new TextEncoder()
  const toolCallSummary: { tool: string; label: string }[] = []
  const suggestedActions: ChatAction[] = []

  // ReadableStream controller set synchronously in start(), safe to use in the IIFE below
  let sseController!: ReadableStreamDefaultController<Uint8Array>
  const readable = new ReadableStream<Uint8Array>({
    start(controller) { sseController = controller },
  })

  // Run the tool-use loop in a background async IIFE so we can return the SSE
  // response immediately and pipe tokens to the client as they arrive.
  ;(async () => {
    let currentMessages: Anthropic.MessageParam[] = messages.slice(-MAX_HISTORY)

    const send = (payload: object) =>
      sseController.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`))

    const finish = () => {
      send({ done: true, toolCalls: toolCallSummary, actions: suggestedActions })
      try { sseController.close() } catch {}
    }

    try {
      // Tool-use loop — max 5 iterations to prevent runaway chains
      for (let i = 0; i < 5; i++) {
        const apiStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
          tools: TOOLS,
          messages: currentMessages,
        }, { signal: AbortSignal.timeout(30_000) })

        // Pipe text tokens to the client in real time — fires on each delta
        apiStream.on('text', (text) => { if (text) send({ t: text }) })

        // finalMessage() awaits the completed stream and gives us the full response
        // for tool detection. The .on('text') handler above runs concurrently.
        const response = await apiStream.finalMessage()

        if (response.stop_reason !== 'tool_use') {
          finish()
          return
        }

        // Execute all tool calls in parallel
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
        )

        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUseBlocks.map(async (block) => {
            if (block.name === 'suggest_actions') {
              const inp = block.input as { actions: ChatAction[] }
              suggestedActions.push(...(inp.actions ?? []))
              return { type: 'tool_result' as const, tool_use_id: block.id, content: '{"ok":true}' }
            }

            const result = await executeTool(block.name, block.input, user.id)

            const inp = block.input as Record<string, unknown>
            if (block.name === 'log_food') {
              toolCallSummary.push({ tool: 'log_food', label: `Logged ${inp.name} → ${inp.meal_type}` })
            } else if (block.name === 'update_daily_metric') {
              toolCallSummary.push({ tool: 'update', label: `Updated ${inp.metric}: ${inp.value}` })
            } else if (block.name === 'get_today_nutrition') {
              toolCallSummary.push({ tool: 'read', label: 'Checked today\'s nutrition' })
            } else if (block.name === 'get_training_history') {
              toolCallSummary.push({ tool: 'read', label: 'Checked training history' })
            } else if (block.name === 'mark_supplements_taken') {
              const names = inp.names as string[]
              toolCallSummary.push({ tool: 'supplement', label: `Marked ${names.join(' + ')} → taken` })
            } else if (block.name === 'log_rest_day') {
              toolCallSummary.push({ tool: 'rest', label: 'Logged rest day — cycle position held' })
            } else if (block.name === 'log_feeling') {
              toolCallSummary.push({ tool: 'feeling', label: 'Saved how you feel today' })
            } else if (block.name === 'save_coaching_note') {
              toolCallSummary.push({ tool: 'memory', label: `Saved coaching note: ${inp.key}` })
            } else if (block.name === 'delete_coaching_note') {
              toolCallSummary.push({ tool: 'memory', label: `Cleared coaching note: ${inp.key}` })
            } else if (block.name === 'get_coaching_notes') {
              toolCallSummary.push({ tool: 'read', label: 'Retrieved coaching history' })
            }

            return { type: 'tool_result' as const, tool_use_id: block.id, content: result }
          }),
        )

        currentMessages = [
          ...currentMessages,
          { role: 'assistant' as const, content: response.content },
          { role: 'user' as const, content: toolResults },
        ]
      }

      send({ t: 'I hit a processing limit. Please try again.' })
      finish()
    } catch {
      try {
        send({ t: 'Something went wrong. Please try again.' })
        finish()
      } catch {}
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}

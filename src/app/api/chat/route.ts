import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getTodayContext, getFullUserContext } from '@/lib/db'
import { buildSystemPrompt } from '@/lib/ai/system-prompt'

const anthropic = new Anthropic()

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'log_food',
    description:
      "Log a food or meal to the user's food log for today. Use this when the user tells you they ate something or asks you to log food.",
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
        .select('date, session_type, duration_min, volume_kg, prs, exercises(name, sets, reps, weight_kg, is_pr)')
        .eq('user_id', userId)
        .gte('date', from.toISOString().split('T')[0])
        .order('date', { ascending: false })
      return JSON.stringify(data ?? [])
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { messages } = await request.json() as {
    messages: Anthropic.MessageParam[]
  }

  const [ctx, userCtx] = await Promise.all([
    getTodayContext(),
    getFullUserContext(),
  ])
  if (!ctx) return new Response('Unauthorized', { status: 401 })

  const systemPrompt = buildSystemPrompt(ctx, userCtx)

  let currentMessages: Anthropic.MessageParam[] = messages
  const toolCallSummary: { tool: string; label: string }[] = []

  // Tool-use loop — max 5 iterations to prevent runaway chains
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages: currentMessages,
    })

    if (response.stop_reason !== 'tool_use') {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')
      return Response.json({ text, toolCalls: toolCallSummary })
    }

    // Execute all tool calls in parallel
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )

    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const result = await executeTool(block.name, block.input, user.id)

        // Build human-readable label for UI feedback
        const inp = block.input as Record<string, unknown>
        if (block.name === 'log_food') {
          toolCallSummary.push({ tool: 'log_food', label: `Logged ${inp.name} → ${inp.meal_type}` })
        } else if (block.name === 'update_daily_metric') {
          toolCallSummary.push({ tool: 'update', label: `Updated ${inp.metric}: ${inp.value}` })
        } else if (block.name === 'get_today_nutrition') {
          toolCallSummary.push({ tool: 'read', label: 'Checked today\'s nutrition' })
        } else if (block.name === 'get_training_history') {
          toolCallSummary.push({ tool: 'read', label: 'Checked training history' })
        }

        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: result,
        }
      }),
    )

    currentMessages = [
      ...currentMessages,
      { role: 'assistant' as const, content: response.content },
      { role: 'user' as const, content: toolResults },
    ]
  }

  return Response.json({
    text: 'I hit a processing limit. Please try again.',
    toolCalls: toolCallSummary,
  })
}

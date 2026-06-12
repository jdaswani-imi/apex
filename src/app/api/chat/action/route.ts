import { createClient } from '@/lib/supabase/server'
import { todayLocal } from '@/lib/date'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { type, payload } = await request.json() as {
    type: string
    payload: Record<string, unknown>
  }

  const today = todayLocal()

  switch (type) {
    case 'log_meal': {
      const { error } = await supabase.from('food_logs').insert({
        user_id: user.id,
        date: today,
        name: payload.name ?? 'Meal',
        meal_type: payload.meal_type ?? 'snack',
        calories: payload.calories ?? null,
        protein_g: payload.protein_g ?? null,
        carbs_g: payload.carbs_g ?? null,
        fats_g: payload.fats_g ?? null,
      })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true })
    }

    case 'log_workout': {
      const { error } = await supabase.from('training_sessions').insert({
        user_id: user.id,
        date: today,
        session_type: payload.session_type ?? 'Workout',
        duration_min: payload.duration_min ?? null,
        volume_kg: payload.volume_kg ?? null,
        prs: payload.prs ?? null,
        notes: payload.notes ?? null,
      })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true })
    }

    case 'log_rest_day': {
      const { error } = await supabase.from('training_sessions').insert({
        user_id: user.id,
        date: today,
        session_type: 'Rest day',
        notes: payload.notes ?? null,
      })
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true })
    }

    case 'log_weight': {
      const { error } = await supabase
        .from('daily_logs')
        .upsert(
          { user_id: user.id, date: today, weight_kg: payload.weight_kg },
          { onConflict: 'user_id,date' },
        )
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true })
    }

    case 'log_steps': {
      const { error } = await supabase
        .from('daily_logs')
        .upsert(
          { user_id: user.id, date: today, steps: payload.steps },
          { onConflict: 'user_id,date' },
        )
      if (error) return Response.json({ error: error.message }, { status: 500 })
      return Response.json({ ok: true })
    }

    case 'mark_supplements_taken': {
      const names = payload.names as string[] | undefined
      if (names && names.length > 0) {
        await Promise.all(
          names.map(name =>
            supabase.from('supplement_logs').upsert(
              { user_id: user.id, date: today, supplement_name: name, taken: true },
              { onConflict: 'user_id,date,supplement_name' },
            ),
          ),
        )
      } else {
        await supabase
          .from('supplement_logs')
          .update({ taken: true })
          .eq('user_id', user.id)
          .eq('date', today)
      }
      return Response.json({ ok: true })
    }

    default:
      return Response.json({ error: 'Unknown action type' }, { status: 400 })
  }
}

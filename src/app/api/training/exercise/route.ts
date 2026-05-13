import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data } = await supabase
    .from('exercises')
    .insert(body)
    .select()
    .single()

  if (body.is_pr && body.name) {
    await supabase
      .from('exercise_baselines')
      .update({
        current_weight_kg: body.weight_kg,
        current_reps: body.reps,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .ilike('exercise_name', `%${body.name}%`)
  }

  return NextResponse.json(data)
}

import { NextResponse } from 'next/server'
import { todayLocal } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { invalidateUserAICaches, invalidateUserFoodCache } from '@/lib/ai-cache'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, meal_type, calories, protein_g, carbs_g, fats_g, meal_rating, meal_suggestions } = body

  const patch: Record<string, unknown> = { name, meal_type, calories, protein_g, carbs_g, fats_g }
  if (meal_rating !== undefined) patch.meal_rating = meal_rating
  if (meal_suggestions !== undefined) patch.meal_suggestions = meal_suggestions

  const { data, error } = await supabase
    .from('food_logs')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await Promise.all([
    invalidateUserAICaches(user.id),
    invalidateUserFoodCache(user.id, data.date),
  ])
  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? todayLocal()

  const { error } = await supabase
    .from('food_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await Promise.all([
    invalidateUserAICaches(user.id),
    invalidateUserFoodCache(user.id, date),
  ])
  return NextResponse.json({ ok: true })
}

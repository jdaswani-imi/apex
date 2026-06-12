import { NextResponse } from 'next/server'
import { todayLocal } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { invalidateUserAICaches, invalidateUserFoodCache } from '@/lib/ai-cache'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const todayStr = todayLocal()
  const date = searchParams.get('date') ?? todayStr

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data } = await supabase
    .from('food_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [], {
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { date, meal_type, name, calories, protein_g, carbs_g, fats_g, notes } = body

  if (!date || !name || !meal_type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('food_logs')
    .insert({ user_id: user.id, date, meal_type, name, calories, protein_g, carbs_g, fats_g, notes })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await Promise.all([
    invalidateUserAICaches(user.id),
    invalidateUserFoodCache(user.id, date),
  ])
  return NextResponse.json(data)
}

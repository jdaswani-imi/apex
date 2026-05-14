import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  let query = supabase
    .from('custom_foods')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (q) query = query.ilike('name', `%${q}%`)

  const { data } = await query.limit(50)
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fats_per_100g, serving_g } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('custom_foods')
    .insert({
      user_id: user.id,
      name: name.trim(),
      brand: brand?.trim() || null,
      calories_per_100g: calories_per_100g ?? null,
      protein_per_100g: protein_per_100g ?? null,
      carbs_per_100g: carbs_per_100g ?? null,
      fats_per_100g: fats_per_100g ?? null,
      serving_g: serving_g ?? 100,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

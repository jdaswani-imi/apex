import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const params = req.nextUrl.searchParams
  const q = params.get('q')?.trim() ?? ''
  const all = params.get('all') === '1'

  const gender = params.get('gender') ?? 'male'
  const selectCols = 'id, name, category, equipment, primary_muscles, force, level, gif_url, gif_url_female, image_url'

  const base = supabase
    .from('exercise_library')
    .select(selectCols)

  function withGender(rows: any[] | null) {
    return (rows ?? []).map(r => ({
      ...r,
      display_gif:
        (gender === 'female' ? r.gif_url_female : r.gif_url)
        ?? r.gif_url ?? r.gif_url_female
        ?? r.image_url ?? null,
    }))
  }

  if (all) {
    const { data } = await base.order('name').limit(1000)
    return NextResponse.json(withGender(data))
  }

  if (q.length < 1) return NextResponse.json([])

  const { data } = await base
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(20)

  return NextResponse.json(withGender(data))
}

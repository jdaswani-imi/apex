import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCachedAI, setCachedAI } from '@/lib/ai-cache'

// Returns the last ~10 distinct foods the user has logged,
// ordered by most recently added. Used to populate "Recent" suggestions.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const cacheKey = `db:recent-foods:${user.id}`
  const cached = await getCachedAI<object[]>(cacheKey)
  if (cached) return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, max-age=60, must-revalidate' } })

  const { data } = await supabase
    .from('food_logs')
    .select('name, calories, protein_g, carbs_g, fats_g, meal_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(60)

  if (!data) return NextResponse.json([])

  // Deduplicate by normalized name, keeping the most recent entry
  const seen = new Set<string>()
  const recent: typeof data = []
  for (const row of data) {
    const key = row.name.toLowerCase().trim()
    if (seen.has(key)) continue
    seen.add(key)
    recent.push(row)
    if (recent.length >= 10) break
  }

  if (recent.length > 0) await setCachedAI(cacheKey, recent, 60)
  return NextResponse.json(recent, {
    headers: { 'Cache-Control': 'private, max-age=60, must-revalidate' },
  })
}

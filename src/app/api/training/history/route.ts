import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data } = await supabase
    .from('training_sessions')
    .select('*, exercises(*)')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(50)

  return NextResponse.json(data ?? [])
}

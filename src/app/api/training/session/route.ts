import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { data } = await supabase
    .from('training_sessions')
    .insert({ user_id: user.id, ...body })
    .select()
    .single()

  return NextResponse.json(data)
}

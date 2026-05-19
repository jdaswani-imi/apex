import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profile')
    .select('api_token')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ token: profile?.api_token ?? null })
}

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('user_profile')
    .update({ api_token: crypto.randomUUID() })
    .eq('user_id', user.id)
    .select('api_token')
    .single()

  return NextResponse.json({ token: data?.api_token ?? null })
}

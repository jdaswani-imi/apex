import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false })

  const { data } = await supabase
    .from('whoop_tokens')
    .select('access_token, expires_at, refresh_token')
    .eq('user_id', user.id)
    .single()

  if (!data?.access_token) return NextResponse.json({ connected: false })

  const expired = new Date(data.expires_at) <= new Date()
  const canRefresh = !!data.refresh_token

  return NextResponse.json({ connected: true, expired, canRefresh })
}

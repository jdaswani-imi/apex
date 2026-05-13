import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connected: false })

  const { data } = await supabase
    .from('whoop_tokens')
    .select('access_token')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ connected: !!data?.access_token })
}

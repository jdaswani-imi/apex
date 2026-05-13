import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureSupplementRows } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  await ensureSupplementRows(user.id, date)

  const { data } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [])
}

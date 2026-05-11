import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_SUPPLEMENTS } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const { data: existing } = await supabase
    .from('supplement_logs')
    .select('supplement_name')
    .eq('user_id', user.id)
    .eq('date', date)

  const existingNames = new Set((existing ?? []).map((r: any) => r.supplement_name))
  const toInsert = DEFAULT_SUPPLEMENTS
    .filter(s => !existingNames.has(s.name))
    .map(s => ({ user_id: user.id, date, supplement_name: s.name, taken: false, notes: s.time }))

  if (toInsert.length > 0) {
    await supabase.from('supplement_logs').insert(toInsert)
  }

  const { data } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('created_at', { ascending: true })

  return NextResponse.json(data ?? [])
}

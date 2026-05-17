import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ensureSupplementRows } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? new Date().toISOString().split('T')[0]

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json([])

  const todayStr = new Date().toISOString().split('T')[0]
  if (date === todayStr) {
    await ensureSupplementRows(user.id, date)
  }

  const [{ data }, { data: userSupps }] = await Promise.all([
    supabase
      .from('supplement_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: true }),
    supabase
      .from('user_supplements')
      .select('name, capsules, frequency_type, frequency_interval, dose')
      .eq('user_id', user.id)
      .eq('active', true),
  ])

  const configMap = Object.fromEntries((userSupps ?? []).map(s => [s.name, s]))
  const enriched = (data ?? []).map(log => ({
    ...log,
    _capsules: configMap[log.supplement_name]?.capsules ?? 1,
    _frequency_type: configMap[log.supplement_name]?.frequency_type ?? 'daily',
    _frequency_interval: configMap[log.supplement_name]?.frequency_interval ?? 1,
    _dose: configMap[log.supplement_name]?.dose ?? null,
  }))

  return NextResponse.json(enriched)
}

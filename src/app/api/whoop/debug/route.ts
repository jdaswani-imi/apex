import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getWhoopToken } from '@/lib/whoop/client'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getWhoopToken(user.id)
  if (!token) return NextResponse.json({ error: 'No token' })

  const start = new Date()
  start.setDate(start.getDate() - 30)

  const url = new URL('https://api.prod.whoop.com/developer/v2/activity/sleep')
  url.searchParams.set('start', start.toISOString())
  url.searchParams.set('limit', '3')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  const text = await res.text()
  let raw: unknown
  try { raw = JSON.parse(text) } catch { raw = text }

  return NextResponse.json({ status: res.status, raw })
}

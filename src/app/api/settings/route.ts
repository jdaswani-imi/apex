import { createClient } from '@/lib/supabase/server'
import { getFullUserContext } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const ctx = await getFullUserContext()
  return NextResponse.json(ctx)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { table, data } = await request.json()

  const allowed = ['user_profile', 'user_goals', 'user_training', 'user_lifestyle']
  if (!allowed.includes(table)) {
    return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  }

  const { error } = await supabase
    .from(table)
    .upsert({ user_id: user.id, ...data, updated_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

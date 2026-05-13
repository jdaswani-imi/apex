import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...rest } = body

  if (id) {
    await supabase.from('user_supplements').update({ ...rest }).eq('id', id).eq('user_id', user.id)
  } else {
    await supabase.from('user_supplements').insert({ user_id: user.id, ...rest })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'No id' }, { status: 400 })

  await supabase.from('user_supplements').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}

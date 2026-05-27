import { createClient } from '@/lib/supabase/server'
import { invalidateUserAICaches } from '@/lib/ai-cache'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  await invalidateUserAICaches(user.id)
  return Response.json({ ok: true })
}

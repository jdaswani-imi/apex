import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ChatClient } from './chat-client'

export const dynamic = 'force-dynamic'

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: onboarding } = await supabase
    .from('user_onboarding')
    .select('completed')
    .eq('user_id', user.id)
    .maybeSingle()

  const params = await searchParams
  return (
    <ChatClient
      onboardingCompleted={onboarding?.completed === true}
      initialInput={params.q ?? ''}
    />
  )
}

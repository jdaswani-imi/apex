import { redirect } from 'next/navigation'
import { todayLocal } from '@/lib/date'
import { createClient } from '@/lib/supabase/server'
import { getUserGoals } from '@/lib/db'
import FoodContent from './FoodContent'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [goals, params] = await Promise.all([getUserGoals(), searchParams])
  const todayStr = todayLocal()
  const viewDate = params.date ?? todayStr

  return (
    <Suspense>
      <FoodContent
        proteinTarget={goals?.daily_protein_target_g ?? 140}
        calorieTarget={goals?.daily_calorie_target ?? 2100}
        viewDate={viewDate}
        todayStr={todayStr}
      />
    </Suspense>
  )
}

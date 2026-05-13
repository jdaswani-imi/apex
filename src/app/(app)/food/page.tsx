import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserGoals } from '@/lib/db'
import FoodContent from './FoodContent'

export const dynamic = 'force-dynamic'

export default async function FoodPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const goals = await getUserGoals()

  return (
    <FoodContent
      proteinTarget={goals?.daily_protein_target_g ?? 140}
      calorieTarget={goals?.daily_calorie_target ?? 2100}
    />
  )
}

import { createClient, getAuthUser } from '@/lib/supabase/server'
import type {
  DailyLog, TrainingSession, Exercise,
  SupplementLog, WhoopRecovery, WhoopSleep,
  WhoopCycle, WhoopWorkout, TodayContext, MenstrualCycle,
} from '@/lib/types'


// ─── Daily Log ────────────────────────────────────────────────────────────────

export async function getDailyLog(date: string): Promise<DailyLog | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const { data } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  return data
}

export async function upsertDailyLog(
  date: string,
  updates: Partial<Omit<DailyLog, 'id' | 'user_id' | 'created_at'>>,
): Promise<DailyLog | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const { data } = await supabase
    .from('daily_logs')
    .upsert({ user_id: user.id, date, ...updates }, { onConflict: 'user_id,date' })
    .select()
    .single()

  return data
}

export async function getRecentDailyLogs(days = 14): Promise<DailyLog[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const { data } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(days)

  return data ?? []
}

// ─── Training ─────────────────────────────────────────────────────────────────

export async function getTodayTraining(date: string): Promise<TrainingSession[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const { data } = await supabase
    .from('training_sessions')
    .select('*, exercises(*)')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function getRecentTraining(days = 30): Promise<TrainingSession[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data } = await supabase
    .from('training_sessions')
    .select('*, exercises(*)')
    .eq('user_id', user.id)
    .gte('date', from.toISOString().split('T')[0])
    .order('date', { ascending: false })

  return data ?? []
}

export async function createTrainingSession(
  session: Omit<TrainingSession, 'id' | 'user_id' | 'created_at' | 'exercises'>,
): Promise<TrainingSession | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const { data } = await supabase
    .from('training_sessions')
    .insert({ user_id: user.id, ...session })
    .select()
    .single()

  return data
}

export async function addExercise(
  exercise: Omit<Exercise, 'id'>,
): Promise<Exercise | null> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('exercises')
    .insert(exercise)
    .select()
    .single()

  return data
}

export async function getExerciseHistory(
  exerciseName: string,
  limit = 10,
): Promise<{ date: string; weight_kg: number | null; reps: number | null; sets: number | null }[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const { data } = await supabase
    .from('exercises')
    .select('weight_kg, reps, sets, training_sessions!inner(date, user_id)')
    .eq('training_sessions.user_id', user.id)
    .ilike('name', `%${exerciseName}%`)
    .limit(limit)

  if (!data) return []

  // Supabase join type inference is limited — cast to access nested relation field
  // The actual runtime shape from the inner join is validated by the query itself
  return (data as unknown as { weight_kg: number | null; reps: number | null; sets: number | null; training_sessions: { date: string } }[])
    .map(e => ({
      date: e.training_sessions.date,
      weight_kg: e.weight_kg,
      reps: e.reps,
      sets: e.sets,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

// ─── Supplements ──────────────────────────────────────────────────────────────

export async function getTodaySupplements(date: string): Promise<SupplementLog[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const todayStr = new Date().toISOString().split('T')[0]
  if (date === todayStr) {
    await ensureSupplementRows(user.id, date)
  }

  const { data } = await supabase
    .from('supplement_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('created_at', { ascending: true })

  return data ?? []
}

export async function ensureSupplementRows(userId: string, date: string): Promise<void> {
  const supabase = await createClient()

  const dayOfWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date(date + 'T12:00:00').getDay()]

  const [{ data: userSupps }, { data: existing }] = await Promise.all([
    supabase
      .from('user_supplements')
      .select('name, timing, timing_notes, days_of_week')
      .eq('user_id', userId)
      .eq('active', true)
      .order('sort_order', { ascending: true }),
    supabase
      .from('supplement_logs')
      .select('supplement_name')
      .eq('user_id', userId)
      .eq('date', date),
  ])

  if (!userSupps || userSupps.length === 0) return

  // Only include supplements scheduled for this day
  const scheduledSupps = userSupps.filter(
    s => !s.days_of_week || s.days_of_week.length === 0 || s.days_of_week.includes(dayOfWeek),
  )
  const scheduledNames = new Set(scheduledSupps.map(s => s.name))

  // Remove stale log entries (supplements no longer active or not scheduled today)
  const staleNames = (existing ?? [])
    .map(r => r.supplement_name)
    .filter(name => !scheduledNames.has(name))

  if (staleNames.length > 0) {
    await supabase
      .from('supplement_logs')
      .delete()
      .eq('user_id', userId)
      .eq('date', date)
      .in('supplement_name', staleNames)
      .eq('taken', false)
  }

  const existingNames = new Set((existing ?? []).map(r => r.supplement_name))

  const toInsert = scheduledSupps
    .filter(s => !existingNames.has(s.name))
    .map(s => ({
      user_id: userId,
      date,
      supplement_name: s.name,
      taken: false,
      notes: s.timing_notes ?? s.timing,
    }))

  if (toInsert.length > 0) {
    await supabase.from('supplement_logs').insert(toInsert)
  }
}

export async function markSupplementTaken(
  date: string,
  supplementName: string,
  taken: boolean,
  timeTaken?: string,
): Promise<void> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return

  await supabase
    .from('supplement_logs')
    .update({ taken, time_taken: timeTaken ?? null })
    .eq('user_id', user.id)
    .eq('date', date)
    .eq('supplement_name', supplementName)
}

export async function getSupplementAdherence(days = 7): Promise<{
  name: string
  taken: number
  total: number
  pct: number
}[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data } = await supabase
    .from('supplement_logs')
    .select('supplement_name, taken')
    .eq('user_id', user.id)
    .gte('date', from.toISOString().split('T')[0])

  if (!data) return []

  const map: Record<string, { taken: number; total: number }> = {}
  for (const row of data) {
    if (!map[row.supplement_name]) map[row.supplement_name] = { taken: 0, total: 0 }
    map[row.supplement_name].total++
    if (row.taken) map[row.supplement_name].taken++
  }

  return Object.entries(map).map(([name, { taken, total }]) => ({
    name,
    taken,
    total,
    pct: Math.round((taken / total) * 100),
  }))
}

// ─── Whoop ────────────────────────────────────────────────────────────────────

export async function getTodayRecovery(date: string): Promise<WhoopRecovery | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const { data } = await supabase
    .from('whoop_recovery')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  return data
}

export async function getTodaySleep(date: string): Promise<WhoopSleep | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  // Sleep starts the night before, so check today and yesterday
  const yesterday = new Date(date)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  const { data } = await supabase
    .from('whoop_sleep')
    .select('*')
    .eq('user_id', user.id)
    .in('date', [date, yesterdayStr])
    .eq('nap', false)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getTodayCycle(date: string): Promise<WhoopCycle | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const { data } = await supabase
    .from('whoop_cycles')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', date)
    .maybeSingle()

  return data
}

export async function getRecentRecovery(days = 14): Promise<WhoopRecovery[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const { data } = await supabase
    .from('whoop_recovery')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(days)

  return data ?? []
}

export async function getRecentSleep(days = 14): Promise<WhoopSleep[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const { data } = await supabase
    .from('whoop_sleep')
    .select('*')
    .eq('user_id', user.id)
    .eq('nap', false)
    .order('date', { ascending: false })
    .limit(days)

  return data ?? []
}

export async function getRecentCycles(days = 30): Promise<WhoopCycle[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const { data } = await supabase
    .from('whoop_cycles')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(days)

  return data ?? []
}

export async function getRecentWorkouts(days = 30): Promise<WhoopWorkout[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const from = new Date()
  from.setDate(from.getDate() - days)

  const { data } = await supabase
    .from('whoop_workouts')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', from.toISOString())
    .order('start_time', { ascending: false })
    .limit(50)

  return data ?? []
}

// ─── Weight ───────────────────────────────────────────────────────────────────

export async function logWeight(date: string, weight_kg: number): Promise<void> {
  await upsertDailyLog(date, { weight_kg })
}

export async function getWeightHistory(days = 30): Promise<{ date: string; weight_kg: number }[]> {
  const logs = await getRecentDailyLogs(days)
  return logs
    .filter(l => l.weight_kg !== null)
    .map(l => ({ date: l.date, weight_kg: l.weight_kg! }))
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function getUserProfile() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabase.from('user_profile').select('*').eq('user_id', user.id).single()
  return data
}

export async function getUserGoals() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabase.from('user_goals').select('*').eq('user_id', user.id).single()
  return data
}

export async function getUserTraining() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabase.from('user_training').select('*').eq('user_id', user.id).single()
  return data
}

export async function getUserSupplements() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []
  const { data } = await supabase
    .from('user_supplements')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('sort_order', { ascending: true })
  return data ?? []
}

export async function getUserLifestyle() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabase.from('user_lifestyle').select('*').eq('user_id', user.id).single()
  return data
}

export async function getExerciseBaselines() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []
  const { data } = await supabase
    .from('exercise_baselines')
    .select('*')
    .eq('user_id', user.id)
    .order('session_type', { ascending: true })
  return data ?? []
}

// These update functions accept partial row shapes that differ per table.
// Using Record<string, unknown> instead of any to preserve type safety at call sites
// while allowing arbitrary column updates without generating Supabase schema types.

export async function updateUserProfile(updates: Record<string, unknown>) {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_profile')
    .upsert({ user_id: user.id, ...updates, updated_at: new Date().toISOString() })
    .select().single()
  return data
}

export async function updateUserGoals(updates: Record<string, unknown>) {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_goals')
    .upsert({ user_id: user.id, ...updates, updated_at: new Date().toISOString() })
    .select().single()
  return data
}

export async function updateUserLifestyle(updates: Record<string, unknown>) {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_lifestyle')
    .upsert({ user_id: user.id, ...updates, updated_at: new Date().toISOString() })
    .select().single()
  return data
}

export async function upsertUserSupplement(supp: Record<string, unknown>) {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null
  const { data } = await supabase
    .from('user_supplements')
    .upsert({ user_id: user.id, ...supp })
    .select().single()
  return data
}

export async function deleteUserSupplement(id: string) {
  const supabase = await createClient()
  await supabase.from('user_supplements').delete().eq('id', id)
}

export async function updateExerciseBaseline(id: string, updates: Record<string, unknown>) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('exercise_baselines')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select().single()
  return data
}

export async function getLatestLabData() {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const { data } = await supabase
    .from('lab_reports')
    .select('filename, report_date, report_type, summary, structured_data, created_at')
    .eq('user_id', user.id)
    .not('structured_data', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getFullUserContext() {
  const [profile, goals, training, supplements, lifestyle, baselines, latestCycle, latestLab] = await Promise.all([
    getUserProfile(),
    getUserGoals(),
    getUserTraining(),
    getUserSupplements(),
    getUserLifestyle(),
    getExerciseBaselines(),
    getLatestCycle(),
    getLatestLabData(),
  ])
  return { profile, goals, training, supplements, lifestyle, baselines, latestCycle, latestLab }
}

// ─── Menstrual Cycle ──────────────────────────────────────────────────────────

export async function getLatestCycle(): Promise<MenstrualCycle | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const { data } = await supabase
    .from('menstrual_cycles')
    .select('*')
    .eq('user_id', user.id)
    .order('period_start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}

export async function getRecentMenstrualCycles(limit = 6): Promise<MenstrualCycle[]> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return []

  const { data } = await supabase
    .from('menstrual_cycles')
    .select('*')
    .eq('user_id', user.id)
    .order('period_start_date', { ascending: false })
    .limit(limit)

  return data ?? []
}

export async function upsertMenstrualCycle(
  updates: Pick<MenstrualCycle, 'period_start_date'> & Partial<Omit<MenstrualCycle, 'id' | 'user_id' | 'created_at'>>,
): Promise<MenstrualCycle | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const { data } = await supabase
    .from('menstrual_cycles')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id,period_start_date' })
    .select()
    .single()

  return data
}

export async function deleteMenstrualCycle(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('menstrual_cycles').delete().eq('id', id)
}

// ─── Full today context (used by AI and dashboard) ────────────────────────────

export async function getTodayContext(dateOverride?: string): Promise<TodayContext | null> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return null

  const today = dateOverride ?? new Date().toISOString().split('T')[0]

  const [
    dailyLog,
    recovery,
    sleep,
    cycle,
    supplements,
    trainingSessions,
    recentLogs,
    recentRecovery,
    recentSleep,
  ] = await Promise.all([
    getDailyLog(today),
    getTodayRecovery(today),
    getTodaySleep(today),
    getTodayCycle(today),
    getTodaySupplements(today),
    getTodayTraining(today),
    getRecentDailyLogs(14),
    getRecentRecovery(14),
    getRecentSleep(14),
  ])

  return {
    date: today,
    dailyLog,
    recovery,
    sleep,
    cycle,
    supplements,
    trainingSessions,
    recentLogs,
    recentRecovery,
    recentSleep,
  }
}

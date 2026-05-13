import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ipgcrpcwbcfifgsnclww.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

interface RawExercise {
  id: string
  name: string
  category: string
  force?: string | null
  level?: string
  mechanic?: string | null
  equipment?: string | null
  primaryMuscles?: string[]
  secondaryMuscles?: string[]
  instructions?: string[]
}

async function seed() {
  console.log('Fetching exercise data...')
  const res = await fetch('https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json')
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
  const exercises: RawExercise[] = await res.json()
  console.log(`Fetched ${exercises.length} exercises`)

  const rows = exercises.map(e => ({
    id: e.id,
    name: e.name,
    category: e.category ?? null,
    force: e.force ?? null,
    level: e.level ?? null,
    mechanic: e.mechanic ?? null,
    equipment: e.equipment ?? null,
    primary_muscles: e.primaryMuscles ?? [],
    secondary_muscles: e.secondaryMuscles ?? [],
    instructions: e.instructions ?? [],
  }))

  const BATCH = 200
  let inserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('exercise_library').upsert(batch, { onConflict: 'id' })
    if (error) { console.error('Batch error:', error); process.exit(1) }
    inserted += batch.length
    console.log(`Inserted ${inserted}/${rows.length}`)
  }

  console.log('Done.')
}

seed().catch(e => { console.error(e); process.exit(1) })

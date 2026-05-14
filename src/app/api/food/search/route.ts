import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── Nutrient IDs (USDA FDC) ──────────────────────────────────────────────────
const USDA_KCAL    = 1008
const USDA_PROTEIN = 1003
const USDA_CARBS   = 1005
const USDA_FAT     = 1004

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, { results: SearchItem[]; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_VERSION = 1

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SearchItem {
  code: string | null
  name: string
  brand: string | null
  serving_g: number | null
  per100: {
    calories: number | null
    protein_g: number | null
    carbs_g: number | null
    fats_g: number | null
  }
  source: 'usda' | 'off' | 'custom'
}

// ── USDA FoodData Central ─────────────────────────────────────────────────────
async function searchUSDA(q: string): Promise<SearchItem[]> {
  const key = process.env.USDA_API_KEY ?? 'DEMO_KEY'
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('query', q)
  url.searchParams.set('pageSize', '20')
  url.searchParams.set('api_key', key)

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()

    return ((data.foods ?? []) as any[])
      .filter((f: any) => f.description?.trim())
      .map((f: any): SearchItem => {
        const nutrients: Record<number, number> = {}
        for (const n of (f.foodNutrients ?? [])) {
          if (n.nutrientId && n.value != null) nutrients[n.nutrientId] = n.value
        }

        let serving_g: number | null = null
        if (f.servingSize && typeof f.servingSize === 'number') {
          const unit = (f.servingSizeUnit ?? '').toLowerCase()
          if (unit === 'g') serving_g = f.servingSize
          else if (unit === 'oz') serving_g = Math.round(f.servingSize * 28.3495)
        }

        const brand = f.brandOwner ?? f.brandName ?? null

        return {
          code: `usda:${f.fdcId}`,
          name: f.description.trim(),
          brand: brand ? String(brand).trim() : null,
          serving_g,
          per100: {
            calories: nutrients[USDA_KCAL] ?? null,
            protein_g: nutrients[USDA_PROTEIN] ?? null,
            carbs_g: nutrients[USDA_CARBS] ?? null,
            fats_g: nutrients[USDA_FAT] ?? null,
          },
          source: 'usda',
        }
      })
      .filter(r => r.per100.calories !== null || r.per100.protein_g !== null)
  } catch {
    return []
  }
}

// ── Open Food Facts ───────────────────────────────────────────────────────────
const OFF_FIELDS = 'product_name,code,brands,nutriments,serving_quantity,serving_quantity_unit'

function parseServingG(raw: unknown): number | null {
  if (typeof raw === 'number' && raw > 0) return raw
  if (typeof raw === 'string') {
    const n = parseFloat(raw)
    return isNaN(n) || n <= 0 ? null : n
  }
  return null
}

function parseCalories(n: Record<string, unknown>): number | null {
  if (typeof n['energy-kcal_100g'] === 'number') return n['energy-kcal_100g'] as number
  if (typeof n['energy_100g'] === 'number') return Math.round((n['energy_100g'] as number) / 4.184)
  return null
}

async function searchOFF(q: string, queryWords: string[]): Promise<SearchItem[]> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', q)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '20')
  url.searchParams.set('sort_by', 'unique_scans_n')
  url.searchParams.set('fields', OFF_FIELDS)

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Apex/1.0 (health tracker; contact@apex.app)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []

    const data = await res.json()

    return ((data.products ?? []) as any[])
      .filter((p: any) => p.product_name?.trim())
      .map((p: any): SearchItem & { _score: number } => {
        const n = p.nutriments ?? {}
        const name = (p.product_name as string).trim()
        const brand = p.brands ? (p.brands as string).split(',')[0].trim() : null
        const haystack = `${name} ${brand ?? ''}`.toLowerCase()
        return {
          code: p.code ?? null,
          name,
          brand,
          serving_g: parseServingG(p.serving_quantity),
          per100: {
            calories: parseCalories(n),
            protein_g: (n['proteins_100g'] as number) ?? null,
            carbs_g: (n['carbohydrates_100g'] as number) ?? null,
            fats_g: (n['fat_100g'] as number) ?? null,
          },
          source: 'off' as const,
          _score: queryWords.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0),
        }
      })
      .filter(r => (r.per100.calories !== null || r.per100.protein_g !== null) && r._score > 0)
      .sort((a: any, b: any) => b._score - a._score)
      .map(({ _score: _, ...r }: any) => r)
  } catch {
    return []
  }
}

// ── Custom foods (user-specific, auth-gated) ──────────────────────────────────
async function searchCustomFoods(q: string): Promise<SearchItem[]> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabase
      .from('custom_foods')
      .select('*')
      .eq('user_id', user.id)
      .ilike('name', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(10)

    return (data ?? []).map((f: any): SearchItem => ({
      code: `custom:${f.id}`,
      name: f.name,
      brand: f.brand ?? null,
      serving_g: f.serving_g ?? 100,
      per100: {
        calories: f.calories_per_100g ?? null,
        protein_g: f.protein_per_100g ?? null,
        carbs_g: f.carbs_per_100g ?? null,
        fats_g: f.fats_per_100g ?? null,
      },
      source: 'custom',
    }))
  } catch {
    return []
  }
}

// ── Merge & deduplicate ───────────────────────────────────────────────────────
function merge(custom: SearchItem[], usda: SearchItem[], off: SearchItem[]): SearchItem[] {
  const seen = new Set<string>()
  const out: SearchItem[] = []

  for (const item of [...custom, ...usda, ...off]) {
    const key = item.name.toLowerCase().replace(/\s+/g, ' ').trim()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
    if (out.length >= 20) break
  }

  return out
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const cacheKey = `v${CACHE_VERSION}:${q.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.results)
  }

  const queryWords = q.toLowerCase().split(/\s+/).filter(Boolean)

  const [custom, usda, off] = await Promise.all([
    searchCustomFoods(q),
    searchUSDA(q),
    searchOFF(q, queryWords),
  ])

  const results = merge(custom, usda, off)

  cache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS })
  return NextResponse.json(results)
}

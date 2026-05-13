import { NextResponse } from 'next/server'

const OFF_FIELDS = 'product_name,code,brands,nutriments,serving_quantity,serving_quantity_unit'

// In-process cache: key → { results, expiresAt }
const cache = new Map<string, { results: unknown[]; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_VERSION = 3  // bump to invalidate stale entries on redeploy

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
  // Fall back to kJ → kcal (1 kcal = 4.184 kJ)
  if (typeof n['energy_100g'] === 'number') return Math.round((n['energy_100g'] as number) / 4.184)
  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const cacheKey = `v${CACHE_VERSION}:${q.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.results)
  }

  // /cgi/search.pl + search_simple=1 restricts matching to the product name field only.
  // The v2 API does full-text search across ALL fields (ingredients, labels, categories)
  // which causes "pear" to match French bread that happens to list pear as an ingredient.
  // sort_by=unique_scans_n ranks by scan popularity within the name-matched set.
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl')
  url.searchParams.set('search_terms', q)
  url.searchParams.set('search_simple', '1')
  url.searchParams.set('json', '1')
  url.searchParams.set('page_size', '25')
  url.searchParams.set('sort_by', 'unique_scans_n')
  url.searchParams.set('fields', OFF_FIELDS)

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Apex/1.0 (health tracker; contact@apex.app)' },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return NextResponse.json([])

    const data = await res.json()
    const products = (data.products ?? []) as any[]

    // Query words used for relevance scoring
    const queryWords = q.toLowerCase().split(/\s+/).filter(Boolean)

    function relevanceScore(name: string, brand: string | null): number {
      const haystack = `${name} ${brand ?? ''}`.toLowerCase()
      return queryWords.reduce((s, w) => s + (haystack.includes(w) ? 1 : 0), 0)
    }

    const seen = new Set<string>()

    const results = products
      .filter(p => p.product_name?.trim())
      .map(p => {
        const n = p.nutriments ?? {}
        const name = (p.product_name as string).trim()
        const brand = p.brands ? (p.brands as string).split(',')[0].trim() : null
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
          _score: relevanceScore(name, brand),
        }
      })
      .filter(r => r.per100.calories !== null || r.per100.protein_g !== null)
      // Drop results where no query word appears in name or brand
      .filter(r => r._score > 0)
      // Deduplicate by normalised name
      .filter(r => {
        const key = r.name.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      // Re-rank: full matches first, then partial
      .sort((a, b) => b._score - a._score)
      .slice(0, 15)
      .map(({ _score: _, ...r }) => r)

    cache.set(cacheKey, { results, expiresAt: Date.now() + CACHE_TTL_MS })
    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}

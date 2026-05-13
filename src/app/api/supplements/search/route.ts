import { NextResponse } from 'next/server'

// NIH Dietary Supplement Label Database (DSLD) — free, no API key required
const DSLD_BASE = 'https://api.ods.od.nih.gov/dsld/v9'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const res = await fetch(
      `${DSLD_BASE}/browse?query=${encodeURIComponent(q)}&limit=10&offset=0`,
      {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 3600 },
      },
    )

    if (!res.ok) {
      return NextResponse.json({ results: [] })
    }

    const data = await res.json()

    // Normalize to a simple shape
    const results = (data.hits ?? []).map((hit: any) => ({
      id: hit._id,
      name: hit._source?.ProductName ?? hit._source?.BrandName ?? 'Unknown',
      brand: hit._source?.BrandName ?? null,
      serving_size: hit._source?.ServingSize ?? null,
      form: hit._source?.ProductType ?? null,
    }))

    return NextResponse.json({ results })
  } catch {
    return NextResponse.json({ results: [] })
  }
}

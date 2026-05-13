'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { UtensilsCrossed, Plus, Trash2, ChevronDown, X, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FoodLog } from '@/lib/types'

const today = new Date().toISOString().split('T')[0]

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

const MEAL_COLORS: Record<MealType, { dot: string; label: string }> = {
  breakfast: { dot: 'bg-amber-400', label: 'text-amber-400' },
  lunch: { dot: 'bg-green-400', label: 'text-green-400' },
  dinner: { dot: 'bg-blue-400', label: 'text-blue-400' },
  snack: { dot: 'bg-zinc-500', label: 'text-zinc-500' },
}

interface SearchResult {
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
}

interface FormState {
  name: string
  meal_type: MealType
  calories: string
  protein_g: string
  carbs_g: string
  fats_g: string
}

const EMPTY_FORM: FormState = {
  name: '',
  meal_type: 'breakfast',
  calories: '',
  protein_g: '',
  carbs_g: '',
  fats_g: '',
}

function r1(n: number) { return Math.round(n * 10) / 10 }
function num(v: string) {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function macrosFromPer100(per100: SearchResult['per100'], grams: number) {
  const scale = grams / 100
  return {
    calories: per100.calories !== null ? Math.round(per100.calories * scale) : null,
    protein_g: per100.protein_g !== null ? r1(per100.protein_g * scale) : null,
    carbs_g: per100.carbs_g !== null ? r1(per100.carbs_g * scale) : null,
    fats_g: per100.fats_g !== null ? r1(per100.fats_g * scale) : null,
  }
}

interface FoodContentProps {
  proteinTarget: number
  calorieTarget: number
}

export default function FoodContent({ proteinTarget, calorieTarget }: FoodContentProps) {
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)
  const [servingG, setServingG] = useState('100')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchLogs = useCallback(async () => {
    const res = await window.fetch(`/api/food?date=${today}`)
    const data = await res.json()
    setLogs(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await window.fetch(`/api/food/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(data)
      } finally {
        setSearching(false)
      }
    }, 400)
  }, [searchQuery])

  // Recalculate macros when serving size changes
  useEffect(() => {
    if (!selectedResult) return
    const g = parseFloat(servingG)
    if (isNaN(g) || g <= 0) return
    const m = macrosFromPer100(selectedResult.per100, g)
    setForm(prev => ({
      ...prev,
      calories: m.calories !== null ? String(m.calories) : '',
      protein_g: m.protein_g !== null ? String(m.protein_g) : '',
      carbs_g: m.carbs_g !== null ? String(m.carbs_g) : '',
      fats_g: m.fats_g !== null ? String(m.fats_g) : '',
    }))
  }, [servingG, selectedResult])

  function pickResult(r: SearchResult) {
    const defaultServing = r.serving_g ?? 100
    const g = defaultServing
    const m = macrosFromPer100(r.per100, g)
    setSelectedResult(r)
    setServingG(String(g))
    setSearchQuery('')
    setSearchResults([])
    setForm(prev => ({
      ...prev,
      name: r.name,
      calories: m.calories !== null ? String(m.calories) : '',
      protein_g: m.protein_g !== null ? String(m.protein_g) : '',
      carbs_g: m.carbs_g !== null ? String(m.carbs_g) : '',
      fats_g: m.fats_g !== null ? String(m.fats_g) : '',
    }))
  }

  function clearSelection() {
    setSelectedResult(null)
    setServingG('100')
    setForm(EMPTY_FORM)
    setSearchQuery('')
  }

  function closeForm() {
    setShowForm(false)
    clearSelection()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)

    const res = await window.fetch('/api/food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        meal_type: form.meal_type,
        name: form.name.trim(),
        calories: num(form.calories),
        protein_g: num(form.protein_g),
        carbs_g: num(form.carbs_g),
        fats_g: num(form.fats_g),
      }),
    })

    if (res.ok) {
      const item: FoodLog = await res.json()
      setLogs(prev => [...prev, item])
      clearSelection()
      setForm(EMPTY_FORM)
      setShowForm(false)
    }

    setSaving(false)
  }

  async function remove(id: string) {
    setDeletingId(id)
    await window.fetch(`/api/food/${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
    setDeletingId(null)
  }

  // Totals
  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories ?? 0),
      protein_g: acc.protein_g + (l.protein_g ?? 0),
      carbs_g: acc.carbs_g + (l.carbs_g ?? 0),
      fats_g: acc.fats_g + (l.fats_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
  )

  const calPct = Math.min(100, Math.round((totals.calories / calorieTarget) * 100))
  const proteinPct = Math.min(100, Math.round((totals.protein_g / proteinTarget) * 100))

  const grouped = MEAL_TYPES
    .map(type => ({ type, items: logs.filter(l => l.meal_type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="px-4 pt-14 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-condensed text-3xl font-bold text-white uppercase tracking-wide">Food Log</h1>
          <p className="text-zinc-500 text-sm mt-1">{today}</p>
        </div>
        <button
          onClick={() => showForm ? closeForm() : setShowForm(true)}
          className={cn(
            'w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200',
            showForm
              ? 'bg-zinc-800 text-zinc-400'
              : 'bg-orange-500 text-black hover:bg-orange-400',
          )}
        >
          {showForm ? <X size={18} /> : <Plus size={18} strokeWidth={2.5} />}
        </button>
      </div>

      {/* Daily Totals */}
      <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <UtensilsCrossed size={13} className="text-orange-400" />
          <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Today's Nutrition</span>
        </div>

        {/* Calories */}
        <div className="mb-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="font-condensed text-3xl font-bold text-orange-400 leading-none">
                {totals.calories > 0 ? totals.calories.toLocaleString() : '—'}
              </span>
              <span className="text-zinc-600 text-xs">/ {calorieTarget.toLocaleString()} kcal</span>
            </div>
            <span className={cn('text-xs font-semibold', calPct >= 90 ? 'text-green-400' : 'text-zinc-500')}>
              {totals.calories > 0 ? `${calPct}%` : '0%'}
            </span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all duration-500',
                calPct >= 100 ? 'bg-green-400' : 'bg-orange-500',
              )}
              style={{ width: `${calPct}%` }}
            />
          </div>
        </div>

        {/* Macros */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Protein', value: totals.protein_g, target: proteinTarget, color: 'text-orange-300', bar: 'bg-orange-400' },
            { label: 'Carbs', value: totals.carbs_g, target: null, color: 'text-yellow-300', bar: 'bg-yellow-400' },
            { label: 'Fat', value: totals.fats_g, target: null, color: 'text-blue-300', bar: 'bg-blue-400' },
          ].map(({ label, value, target, color, bar }) => {
            const pct = target ? Math.min(100, Math.round((value / target) * 100)) : null
            return (
              <div key={label} className="bg-white/[0.03] rounded-xl p-3">
                <p className={cn('font-condensed text-xl font-bold leading-none', value > 0 ? color : 'text-zinc-700')}>
                  {value > 0 ? `${Math.round(value)}` : '—'}
                  {value > 0 && <span className="text-[10px] font-normal text-zinc-600 ml-0.5">g</span>}
                </p>
                <p className="text-zinc-600 text-[10px] mt-1 font-medium">{label}</p>
                {pct !== null && value > 0 && (
                  <div className="w-full bg-white/5 rounded-full h-0.5 mt-1.5">
                    <div className={cn('h-0.5 rounded-full', bar)} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Add food form */}
      {showForm && (
        <form
          onSubmit={submit}
          className="bg-zinc-900/80 border border-white/[0.08] rounded-2xl p-4 mb-4 space-y-3"
        >
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Add Food</p>

          {/* Search bar */}
          {!selectedResult ? (
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search food database…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none focus:border-orange-500/50 transition-colors"
                  autoFocus
                />
                {searching && (
                  <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 animate-spin" />
                )}
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="bg-zinc-950/80 border border-white/[0.06] rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  {searchResults.map((r, i) => (
                    <button
                      key={r.code ?? i}
                      type="button"
                      onClick={() => pickResult(r)}
                      className="w-full text-left px-3 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-b-0"
                    >
                      <p className="text-sm text-zinc-100 truncate leading-snug">{r.name}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        {[
                          r.brand,
                          r.per100.calories !== null && `${Math.round(r.per100.calories)} kcal`,
                          r.per100.protein_g !== null && `${r1(r.per100.protein_g)}g P`,
                          r.per100.carbs_g !== null && `${r1(r.per100.carbs_g)}g C`,
                          r.per100.fats_g !== null && `${r1(r.per100.fats_g)}g F`,
                        ].filter(Boolean).join(' · ')}
                        <span className="text-zinc-700"> per 100g</span>
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-zinc-700 text-xs px-1">No results — fill in manually below</p>
              )}

              {/* Manual name entry divider */}
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-white/[0.04]" />
                <span className="text-[10px] text-zinc-700 uppercase tracking-wider">or enter manually</span>
                <div className="h-px flex-1 bg-white/[0.04]" />
              </div>

              <input
                type="text"
                placeholder="Food name"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>
          ) : (
            /* Selected food — show with serving size adjuster */
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-100 leading-snug truncate">{selectedResult.name}</p>
                  {selectedResult.brand && (
                    <p className="text-[11px] text-zinc-600 mt-0.5">{selectedResult.brand}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-zinc-700 hover:text-zinc-400 transition-colors shrink-0 mt-0.5"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Serving size */}
              <div className="flex items-center gap-2 mt-3">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold shrink-0">Serving</p>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="any"
                  value={servingG}
                  onChange={e => setServingG(e.target.value)}
                  className="w-20 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-sm text-zinc-200 outline-none focus:border-orange-500/50 transition-colors text-center"
                />
                <span className="text-zinc-600 text-xs">g</span>
                <span className="text-zinc-700 text-[10px] ml-auto">
                  {selectedResult.per100.calories !== null && `${Math.round(selectedResult.per100.calories)} kcal / 100g`}
                </span>
              </div>
            </div>
          )}

          {/* Meal type */}
          <div className="relative">
            <select
              value={form.meal_type}
              onChange={e => setForm(p => ({ ...p, meal_type: e.target.value as MealType }))}
              className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-orange-500/50 transition-colors pr-8"
            >
              {MEAL_TYPES.map(t => (
                <option key={t} value={t}>{MEAL_LABELS[t]}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          </div>

          {/* Macros row */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'calories' as const, label: 'Cal', placeholder: 'kcal' },
              { key: 'protein_g' as const, label: 'Protein', placeholder: '0g' },
              { key: 'carbs_g' as const, label: 'Carbs', placeholder: '0g' },
              { key: 'fats_g' as const, label: 'Fat', placeholder: '0g' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <p className="text-[9px] text-zinc-700 uppercase tracking-wider font-semibold mb-1 px-1">{label}</p>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 py-2 text-sm text-zinc-300 placeholder-zinc-700 outline-none focus:border-orange-500/50 transition-colors text-center"
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving || (!form.name.trim() && !selectedResult)}
            className="w-full bg-orange-500 text-black font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-orange-400 transition-colors active:scale-[0.98]"
          >
            {saving ? 'Adding…' : 'Add to Log'}
          </button>
        </form>
      )}

      {/* Meal groups */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900/60 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center mb-4">
            <UtensilsCrossed size={22} className="text-orange-500/50" />
          </div>
          <p className="text-zinc-500 text-sm font-medium">Nothing logged yet</p>
          <p className="text-zinc-700 text-xs mt-1">Tap + to add your first meal</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ type, items }) => {
            const groupCals = items.reduce((s, l) => s + (l.calories ?? 0), 0)
            const { dot, label } = MEAL_COLORS[type]
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <span className={cn('w-1.5 h-1.5 rounded-full', dot)} />
                    <p className={cn('text-[11px] uppercase tracking-widest font-semibold', label)}>
                      {MEAL_LABELS[type]}
                    </p>
                  </div>
                  {groupCals > 0 && (
                    <span className="text-zinc-600 text-[10px] font-medium">{groupCals} kcal</span>
                  )}
                </div>

                <div className="space-y-2">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">{item.name}</p>
                        <p className="text-zinc-600 text-xs mt-0.5">
                          {[
                            item.calories !== null && `${item.calories} kcal`,
                            item.protein_g !== null && `${item.protein_g}g P`,
                            item.carbs_g !== null && `${item.carbs_g}g C`,
                            item.fats_g !== null && `${item.fats_g}g F`,
                          ].filter(Boolean).join(' · ') || 'No macros logged'}
                        </p>
                      </div>
                      <button
                        onClick={() => remove(item.id)}
                        disabled={deletingId === item.id}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 shrink-0 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

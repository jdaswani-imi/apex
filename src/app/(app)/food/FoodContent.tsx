'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { UtensilsCrossed, Plus, Trash2, ChevronDown, X, Search, Loader2, Star, BookmarkPlus, Sparkles, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FoodLog } from '@/lib/types'
import { AITipButton } from '@/components/ai-tip-button'

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

const OZ_PER_G = 1 / 28.3495

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
  source?: 'usda' | 'off' | 'custom'
}

interface RecentFood {
  name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fats_g: number | null
  meal_type: string
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

// Custom food creation form
interface CustomFoodForm {
  name: string
  brand: string
  calories_per_100g: string
  protein_per_100g: string
  carbs_per_100g: string
  fats_per_100g: string
  serving_g: string
}

const EMPTY_CUSTOM: CustomFoodForm = {
  name: '',
  brand: '',
  calories_per_100g: '',
  protein_per_100g: '',
  carbs_per_100g: '',
  fats_per_100g: '',
  serving_g: '100',
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

interface MealPlanItem {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  name: string
  description: string
  calories: number
  protein_g: number
  carbs_g: number
  fats_g: number
  prep_note: string
}

interface MealPlan {
  date: string
  total_calories: number
  total_protein_g: number
  meals: MealPlanItem[]
}

interface FoodContentProps {
  proteinTarget: number
  calorieTarget: number
  isTrainingDay?: boolean
}

type FormTab = 'search' | 'create'
type ServingUnit = 'g' | 'oz'

export default function FoodContent({ proteinTarget, calorieTarget, isTrainingDay = false }: FoodContentProps) {
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Meal plan state
  const [showMealPlan, setShowMealPlan] = useState(false)
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [addedMeals, setAddedMeals] = useState<Set<number>>(new Set())
  const [addingMealIdx, setAddingMealIdx] = useState<number | null>(null)

  // Form tabs: search the DB or create a custom food
  const [formTab, setFormTab] = useState<FormTab>('search')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)

  // Serving size
  const [servingG, setServingG] = useState('100')
  const [servingUnit, setServingUnit] = useState<ServingUnit>('g')

  // Recent foods
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([])
  const [recentLoaded, setRecentLoaded] = useState(false)

  // Custom food creation
  const [customForm, setCustomForm] = useState<CustomFoodForm>(EMPTY_CUSTOM)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customSaved, setCustomSaved] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef = useRef<HTMLDivElement | null>(null)

  const fetchLogs = useCallback(async () => {
    const res = await window.fetch(`/api/food?date=${today}`)
    const data = await res.json()
    setLogs(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLogs().catch(() => setLoading(false))
  }, [fetchLogs])

  // Fetch recent foods once when form opens
  useEffect(() => {
    if (!showForm || recentLoaded) return
    window.fetch('/api/food/recent')
      .then(r => r.json())
      .then(data => { setRecentFoods(data); setRecentLoaded(true) })
      .catch(() => setRecentLoaded(true))
  }, [showForm, recentLoaded])

  // Debounced search — all setState calls are inside async callbacks to satisfy
  // the react-hooks/set-state-in-effect rule (no synchronous setState in effect body)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (searchQuery.length < 2) {
      // Defer clear to async context so it's not a synchronous setState call
      searchTimer.current = setTimeout(() => { setSearchResults([]) }, 0)
      return () => {
        if (searchTimer.current) clearTimeout(searchTimer.current)
      }
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await window.fetch(`/api/food/search?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSearchResults(data)
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQuery])

  // Recalculate macros when serving size or unit changes
  // setState deferred to microtask to satisfy react-hooks/set-state-in-effect
  useEffect(() => {
    if (!selectedResult) return
    const g = servingUnit === 'oz'
      ? parseFloat(servingG) / OZ_PER_G
      : parseFloat(servingG)
    if (isNaN(g) || g <= 0) return
    const m = macrosFromPer100(selectedResult.per100, g)
    const id = setTimeout(() => {
      setForm(prev => ({
        ...prev,
        calories: m.calories !== null ? String(m.calories) : '',
        protein_g: m.protein_g !== null ? String(m.protein_g) : '',
        carbs_g: m.carbs_g !== null ? String(m.carbs_g) : '',
        fats_g: m.fats_g !== null ? String(m.fats_g) : '',
      }))
    }, 0)
    return () => clearTimeout(id)
  }, [servingG, servingUnit, selectedResult])

  function pickResult(r: SearchResult) {
    const defaultG = r.serving_g ?? 100
    const m = macrosFromPer100(r.per100, defaultG)
    setSelectedResult(r)
    setServingG(servingUnit === 'oz' ? r1(defaultG * OZ_PER_G).toString() : String(defaultG))
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

  function pickRecent(r: RecentFood) {
    setSelectedResult(null)
    setForm({
      name: r.name,
      meal_type: (MEAL_TYPES.includes(r.meal_type as MealType) ? r.meal_type : 'snack') as MealType,
      calories: r.calories !== null ? String(r.calories) : '',
      protein_g: r.protein_g !== null ? String(r.protein_g) : '',
      carbs_g: r.carbs_g !== null ? String(r.carbs_g) : '',
      fats_g: r.fats_g !== null ? String(r.fats_g) : '',
    })
    setSearchQuery('')
    setSearchResults([])
  }

  function clearSelection() {
    setSelectedResult(null)
    setServingG('100')
    setForm(EMPTY_FORM)
    setSearchQuery('')
  }

  function closeForm() {
    setShowForm(false)
    setFormTab('search')
    setCustomForm(EMPTY_CUSTOM)
    setCustomSaved(false)
    clearSelection()
  }

  function switchUnit(unit: ServingUnit) {
    if (!selectedResult) { setServingUnit(unit); return }
    const currentG = servingUnit === 'oz'
      ? parseFloat(servingG) / OZ_PER_G
      : parseFloat(servingG)
    setServingUnit(unit)
    if (!isNaN(currentG)) {
      setServingG(unit === 'oz' ? r1(currentG * OZ_PER_G).toString() : String(Math.round(currentG)))
    }
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
      setRecentLoaded(false)
      // Stay open for the same meal — just clear the food selection
      const keepMeal = form.meal_type
      clearSelection()
      setForm({ ...EMPTY_FORM, meal_type: keepMeal })
    }

    setSaving(false)
  }

  async function saveCustomFood() {
    if (!customForm.name.trim()) return
    setSavingCustom(true)
    const res = await window.fetch('/api/food/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customForm.name.trim(),
        brand: customForm.brand.trim() || null,
        calories_per_100g: num(customForm.calories_per_100g),
        protein_per_100g: num(customForm.protein_per_100g),
        carbs_per_100g: num(customForm.carbs_per_100g),
        fats_per_100g: num(customForm.fats_per_100g),
        serving_g: num(customForm.serving_g) ?? 100,
      }),
    })
    if (res.ok) {
      setCustomSaved(true)
      // Auto-select the new custom food so user can log it immediately
      const saved = await res.json()
      const serving = saved.serving_g ?? 100
      const per100 = {
        calories: saved.calories_per_100g,
        protein_g: saved.protein_per_100g,
        carbs_g: saved.carbs_per_100g,
        fats_g: saved.fats_per_100g,
      }
      setFormTab('search')
      setCustomForm(EMPTY_CUSTOM)
      pickResult({
        code: `custom:${saved.id}`,
        name: saved.name,
        brand: saved.brand,
        serving_g: serving,
        per100,
        source: 'custom',
      })
    }
    setSavingCustom(false)
  }

  function openFormForMeal(meal: MealType) {
    clearSelection()
    setForm({ ...EMPTY_FORM, meal_type: meal })
    setFormTab('search')
    setShowForm(true)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  async function remove(id: string) {
    setDeletingId(id)
    await window.fetch(`/api/food/${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
    setDeletingId(null)
  }

  async function generateMealPlan() {
    setGeneratingPlan(true)
    setMealPlan(null)
    setAddedMeals(new Set())
    setShowMealPlan(true)
    try {
      const res = await window.fetch('/api/ai/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_training_day: isTrainingDay }),
      })
      const plan = await res.json() as MealPlan
      setMealPlan(plan)
    } finally {
      setGeneratingPlan(false)
    }
  }

  async function addMealToLog(item: MealPlanItem, idx: number) {
    setAddingMealIdx(idx)
    const res = await window.fetch('/api/food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: today,
        meal_type: item.meal_type,
        name: item.name,
        calories: item.calories,
        protein_g: item.protein_g,
        carbs_g: item.carbs_g,
        fats_g: item.fats_g,
      }),
    })
    if (res.ok) {
      const logged: FoodLog = await res.json()
      setLogs(prev => [...prev, logged])
      setAddedMeals(prev => new Set([...prev, idx]))
    }
    setAddingMealIdx(null)
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

  const grouped = MEAL_TYPES
    .map(type => ({ type, items: logs.filter(l => l.meal_type === type) }))

  const showRecent = searchQuery.length < 2 && !selectedResult && recentFoods.length > 0

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-condensed text-3xl font-bold text-white uppercase tracking-wide">Food Log</h1>
          <p className="text-zinc-500 text-sm mt-1">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={generateMealPlan}
            title="Generate AI meal plan"
            className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 hover:bg-orange-500/20 transition-all duration-200"
          >
            <Sparkles size={16} />
          </button>
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
      </div>

      {/* Daily Totals */}
      <div className="bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={13} className="text-orange-400" />
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Today&apos;s Nutrition</span>
          </div>
          <AITipButton page="food" />
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
        <div ref={formRef} className="bg-zinc-900/80 border border-white/[0.08] rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Add Food</p>
            {/* Tab switcher */}
            <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => { setFormTab('search'); setCustomForm(EMPTY_CUSTOM); setCustomSaved(false) }}
                className={cn(
                  'text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all',
                  formTab === 'search' ? 'bg-orange-500 text-black' : 'text-zinc-500 hover:text-zinc-300',
                )}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => { setFormTab('create'); clearSelection() }}
                className={cn(
                  'flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all',
                  formTab === 'create' ? 'bg-orange-500 text-black' : 'text-zinc-500 hover:text-zinc-300',
                )}
              >
                <BookmarkPlus size={10} />
                Custom
              </button>
            </div>
          </div>

          {formTab === 'search' ? (
            <form onSubmit={submit} className="space-y-3">
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

                  {/* Recent foods (shown when not searching) */}
                  {showRecent && (
                    <div>
                      <p className="text-[9px] text-zinc-700 uppercase tracking-wider font-semibold px-1 mb-1.5">Recent</p>
                      <div className="bg-zinc-950/80 border border-white/[0.06] rounded-xl overflow-hidden">
                        {recentFoods.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => pickRecent(r)}
                            className="w-full text-left px-3 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-b-0"
                          >
                            <p className="text-sm text-zinc-100 truncate leading-snug">{r.name}</p>
                            <p className="text-[10px] text-zinc-600 mt-0.5">
                              {[
                                r.calories !== null && `${r.calories} kcal`,
                                r.protein_g !== null && `${r.protein_g}g P`,
                                r.carbs_g !== null && `${r.carbs_g}g C`,
                                r.fats_g !== null && `${r.fats_g}g F`,
                              ].filter(Boolean).join(' · ')}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm text-zinc-100 truncate leading-snug flex-1">{r.name}</p>
                            {r.source === 'custom' && (
                              <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full">Mine</span>
                            )}
                            {r.source === 'usda' && (
                              <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">USDA</span>
                            )}
                          </div>
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
                    <p className="text-zinc-700 text-xs px-1">
                      No results — fill in manually below or{' '}
                      <button type="button" className="text-orange-500 underline" onClick={() => { setFormTab('create'); setCustomForm(f => ({ ...f, name: searchQuery })) }}>
                        create a custom food
                      </button>
                    </p>
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
                /* Selected food — serving size adjuster */
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-zinc-100 leading-snug truncate">{selectedResult.name}</p>
                        {selectedResult.source === 'custom' && (
                          <Star size={11} className="text-orange-400 shrink-0 fill-orange-400" />
                        )}
                      </div>
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

                  {/* Serving size + unit toggle */}
                  <div className="flex items-center gap-2 mt-3">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold shrink-0">Serving</p>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      step="any"
                      value={servingG}
                      onChange={e => setServingG(e.target.value)}
                      className="w-20 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-sm text-zinc-200 outline-none focus:border-orange-500/50 transition-colors text-center"
                    />
                    {/* g / oz toggle */}
                    <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
                      {(['g', 'oz'] as ServingUnit[]).map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => switchUnit(u)}
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all',
                            servingUnit === u ? 'bg-orange-500 text-black' : 'text-zinc-500 hover:text-zinc-300',
                          )}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                    <span className="text-zinc-700 text-[10px] ml-auto">
                      {selectedResult.per100.calories !== null && `${Math.round(selectedResult.per100.calories)} kcal/100g`}
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
          ) : (
            /* Create custom food tab */
            <div className="space-y-3">
              <p className="text-[10px] text-zinc-600">Save a food once — it&apos;ll appear in your personal search results.</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <p className="text-[9px] text-zinc-700 uppercase tracking-wider font-semibold mb-1 px-1">Food Name *</p>
                  <input
                    type="text"
                    placeholder="e.g. My Protein Shake"
                    value={customForm.name}
                    onChange={e => setCustomForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none focus:border-orange-500/50 transition-colors"
                    autoFocus
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[9px] text-zinc-700 uppercase tracking-wider font-semibold mb-1 px-1">Brand (optional)</p>
                  <input
                    type="text"
                    placeholder="Brand name"
                    value={customForm.brand}
                    onChange={e => setCustomForm(p => ({ ...p, brand: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              </div>

              <p className="text-[9px] text-zinc-600 uppercase tracking-wider font-semibold px-1">Macros per 100g</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'calories_per_100g' as const, label: 'Cal' },
                  { key: 'protein_per_100g' as const, label: 'Protein' },
                  { key: 'carbs_per_100g' as const, label: 'Carbs' },
                  { key: 'fats_per_100g' as const, label: 'Fat' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <p className="text-[9px] text-zinc-700 uppercase tracking-wider font-semibold mb-1 px-1">{label}</p>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={customForm[key]}
                      onChange={e => setCustomForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 py-2 text-sm text-zinc-300 placeholder-zinc-700 outline-none focus:border-orange-500/50 transition-colors text-center"
                    />
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[9px] text-zinc-700 uppercase tracking-wider font-semibold mb-1 px-1">Default Serving (g)</p>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="any"
                  value={customForm.serving_g}
                  onChange={e => setCustomForm(p => ({ ...p, serving_g: e.target.value }))}
                  className="w-28 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-zinc-300 outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={saveCustomFood}
                disabled={savingCustom || !customForm.name.trim()}
                className="w-full bg-orange-500 text-black font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-orange-400 transition-colors active:scale-[0.98]"
              >
                {savingCustom ? 'Saving…' : customSaved ? 'Saved! ✓' : 'Save & Log Food'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Meal groups */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900/60 rounded-2xl animate-pulse" />
          ))}
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
                  <div className="flex items-center gap-2">
                    {groupCals > 0 && (
                      <span className="text-zinc-600 text-[10px] font-medium">{groupCals} kcal</span>
                    )}
                    <button
                      onClick={() => openFormForMeal(type)}
                      className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.10] transition-all"
                      title={`Add to ${MEAL_LABELS[type]}`}
                    >
                      <Plus size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <button
                    onClick={() => openFormForMeal(type)}
                    className="w-full bg-zinc-900/40 border border-dashed border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-2 text-zinc-700 hover:text-zinc-500 hover:border-white/[0.10] transition-all"
                  >
                    <Plus size={13} strokeWidth={2} />
                    <span className="text-xs">Add {MEAL_LABELS[type].toLowerCase()}</span>
                  </button>
                ) : (
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
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Meal Plan Sheet */}
      {showMealPlan && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowMealPlan(false) }}
        >
          <div style={{
            backgroundColor: '#0a0a0a',
            borderTop: '1px solid #1c1c1c',
            borderRadius: '24px 24px 0 0',
            maxHeight: '88dvh',
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Sheet header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 16px 12px',
              borderBottom: '1px solid #111', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={14} color="#f97316" />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Today&apos;s Meal Plan</span>
              </div>
              <button
                onClick={() => setShowMealPlan(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#52525b' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Sheet body */}
            <div style={{ overflowY: 'auto', padding: '16px', flex: 1 }}>
              {generatingPlan ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0', color: '#52525b' }}>
                  <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: '#f97316' }} />
                  <span style={{ fontSize: '13px' }}>Generating your personalised plan…</span>
                </div>
              ) : mealPlan ? (
                <>
                  {/* Totals pill */}
                  <div style={{
                    display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px',
                  }}>
                    {[
                      { label: 'kcal', value: mealPlan.total_calories },
                      { label: 'protein', value: `${mealPlan.total_protein_g}g` },
                    ].map(({ label, value }) => (
                      <div key={label} style={{
                        backgroundColor: '#111', border: '1px solid #1c1c1c',
                        borderRadius: '10px', padding: '5px 12px',
                        fontSize: '12px', color: '#a1a1aa',
                      }}>
                        <span style={{ fontWeight: 700, color: '#fff' }}>{value}</span> {label}
                      </div>
                    ))}
                  </div>

                  {/* Meal items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {mealPlan.meals.map((item, idx) => {
                      const added = addedMeals.has(idx)
                      const adding = addingMealIdx === idx
                      const MEAL_DOT: Record<string, string> = {
                        breakfast: '#fbbf24', lunch: '#4ade80',
                        dinner: '#60a5fa', snack: '#71717a',
                      }
                      return (
                        <div key={idx} style={{
                          backgroundColor: '#111', border: '1px solid #1c1c1c',
                          borderRadius: '16px', padding: '14px',
                          opacity: added ? 0.5 : 1,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                <span style={{
                                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                                  backgroundColor: MEAL_DOT[item.meal_type] ?? '#71717a',
                                }} />
                                <span style={{ fontSize: '10px', fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                  {item.meal_type}
                                </span>
                                <span style={{ fontSize: '10px', color: '#3f3f46' }}>· {item.prep_note}</span>
                              </div>
                              <p style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7', margin: '0 0 4px' }}>{item.name}</p>
                              <p style={{ fontSize: '12px', color: '#52525b', margin: '0 0 8px', lineHeight: '1.4' }}>{item.description}</p>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                {[
                                  { label: 'P', value: item.protein_g, color: '#f97316' },
                                  { label: 'C', value: item.carbs_g, color: '#facc15' },
                                  { label: 'F', value: item.fats_g, color: '#60a5fa' },
                                ].map(({ label, value, color }) => (
                                  <span key={label} style={{ fontSize: '11px', color: '#52525b' }}>
                                    <span style={{ fontWeight: 700, color }}>{value}</span>{label}
                                  </span>
                                ))}
                                <span style={{ fontSize: '11px', color: '#3f3f46' }}>{item.calories} kcal</span>
                              </div>
                            </div>
                            <button
                              onClick={() => !added && addMealToLog(item, idx)}
                              disabled={added || adding}
                              style={{
                                width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                                backgroundColor: added ? 'rgba(74,222,128,0.1)' : 'rgba(249,115,22,0.1)',
                                border: `1px solid ${added ? 'rgba(74,222,128,0.2)' : 'rgba(249,115,22,0.2)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: added ? 'default' : 'pointer',
                              }}
                            >
                              {adding ? (
                                <Loader2 size={13} color="#f97316" style={{ animation: 'spin 1s linear infinite' }} />
                              ) : added ? (
                                <Check size={13} color="#4ade80" />
                              ) : (
                                <Plus size={13} color="#f97316" />
                              )}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Regenerate */}
                  <button
                    onClick={generateMealPlan}
                    style={{
                      marginTop: '16px', width: '100%',
                      backgroundColor: 'transparent', border: '1px solid #1c1c1c',
                      borderRadius: '12px', padding: '10px',
                      fontSize: '13px', color: '#52525b', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    }}
                  >
                    <Sparkles size={12} /> Generate new plan
                  </button>
                </>
              ) : null}
            </div>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  )
}

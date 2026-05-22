'use client'

import { useEffect, useState, useCallback, useRef, memo } from 'react'

// Session-level cache keyed by date string. Evicted on any mutation so stale
// data never lingers, but navigating back to an already-viewed date is instant.
const foodCache = new Map<string, FoodLog[]>()
import { UtensilsCrossed, Plus, Trash2, ChevronDown, X, Search, Loader2, Star, BookmarkPlus, Sparkles, Check, Pencil, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FoodLog } from '@/lib/types'
import { AITipButton } from '@/components/ai-tip-button'
import { DayNav } from '@/components/day-nav'
import { PageInsightBanner } from '@/components/page-insight-banner'

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
  snack: { dot: 'bg-muted', label: 'text-muted-foreground' },
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
  already_logged_calories?: number
  already_logged_protein_g?: number
}

interface FoodContentProps {
  proteinTarget: number
  calorieTarget: number
  isTrainingDay?: boolean
  viewDate?: string
  todayStr?: string
}

type FormTab = 'search' | 'create' | 'photo'
type ServingUnit = 'g' | 'oz'

const FoodContent = memo(function FoodContent({ proteinTarget, calorieTarget, isTrainingDay = false, viewDate: viewDateProp, todayStr: todayStrProp }: FoodContentProps) {
  const todayStr = todayStrProp ?? new Date().toISOString().split('T')[0]
  const viewDate = viewDateProp ?? todayStr
  const isToday = viewDate === todayStr
  const dateLabel = new Date(viewDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const [logs, setLogs] = useState<FoodLog[]>(() => foodCache.get(viewDate) ?? [])
  const [loading, setLoading] = useState(!foodCache.has(viewDate))
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)

  // Meal plan state
  const [showMealPlan, setShowMealPlan] = useState(false)
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null)
  const [mealPlanError, setMealPlanError] = useState<string | null>(null)
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

  // Photo analysis
  const [analyzing, setAnalyzing] = useState(false)
  const [aiEstimated, setAiEstimated] = useState(false)
  const [aiNotes, setAiNotes] = useState<string | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [photoDesc, setPhotoDesc] = useState('')
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!showForm) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeForm() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm])

  const fetchLogs = useCallback(async () => {
    const cached = foodCache.get(viewDate)
    if (cached) {
      setLogs(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    const res = await window.fetch(`/api/food?date=${viewDate}`)
    const data = await res.json()
    foodCache.set(viewDate, data)
    setLogs(data)
    setLoading(false)
  }, [viewDate])

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
    }, 300)
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

  function clearPhotos() {
    photoPreviews.forEach(url => URL.revokeObjectURL(url))
    setPhotoFiles([])
    setPhotoPreviews([])
    setPhotoDesc('')
  }

  function closeForm() {
    setShowForm(false)
    setFormTab('search')
    setCustomForm(EMPTY_CUSTOM)
    setCustomSaved(false)
    setAiEstimated(false)
    setAiNotes(null)
    clearPhotos()
    clearSelection()
  }

  function addPhotoFiles(incoming: FileList | null) {
    if (!incoming) return
    const newFiles = Array.from(incoming)
    const newPreviews = newFiles.map(f => URL.createObjectURL(f))
    setPhotoFiles(prev => [...prev, ...newFiles])
    setPhotoPreviews(prev => [...prev, ...newPreviews])
  }

  function removePhoto(idx: number) {
    URL.revokeObjectURL(photoPreviews[idx])
    setPhotoFiles(prev => prev.filter((_, i) => i !== idx))
    setPhotoPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  async function analyzePhotos() {
    if (photoFiles.length === 0) return
    setAnalyzing(true)
    setAiEstimated(false)
    setAiNotes(null)
    try {
      const fd = new FormData()

      for (const file of photoFiles) {
        const resized = await new Promise<Blob>((resolve) => {
          const img = new Image()
          const url = URL.createObjectURL(file)
          img.onload = () => {
            URL.revokeObjectURL(url)
            const scale = Math.min(1, 1024 / img.width)
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
            canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85)
          }
          img.src = url
        })
        fd.append('image', resized, 'photo.jpg')
      }

      if (photoDesc.trim()) fd.append('description', photoDesc.trim())

      const res = await window.fetch('/api/ai/analyze-food', { method: 'POST', body: fd })
      const data = await res.json()

      if (data.error) {
        alert(data.error === 'No food detected' ? 'No food detected — try clearer shots.' : `Could not analyze: ${data.error}`)
        return
      }

      clearSelection()
      setForm(prev => ({
        ...prev,
        name: data.name ?? '',
        calories: data.calories != null ? String(data.calories) : '',
        protein_g: data.protein_g != null ? String(data.protein_g) : '',
        carbs_g: data.carbs_g != null ? String(data.carbs_g) : '',
        fats_g: data.fats_g != null ? String(data.fats_g) : '',
      }))
      setAiEstimated(true)
      setAiNotes(data.notes ?? null)
      clearPhotos()
      setFormTab('search')
    } finally {
      setAnalyzing(false)
    }
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
        date: viewDate,
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
      foodCache.delete(viewDate)
      setLogs(prev => {
        const updated = [...prev, item]
        foodCache.set(viewDate, updated)
        return updated
      })
      setRecentLoaded(false)

      // Silently persist USDA/OFF items to the user's custom food library
      // so they surface first in future searches without re-hitting external APIs.
      if (selectedResult && selectedResult.source !== 'custom') {
        const g = servingUnit === 'oz'
          ? parseFloat(servingG) / OZ_PER_G
          : parseFloat(servingG)
        const defaultServing = isNaN(g) || g <= 0 ? (selectedResult.serving_g ?? 100) : g
        window.fetch('/api/food/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: selectedResult.name,
            brand: selectedResult.brand ?? null,
            calories_per_100g: selectedResult.per100.calories,
            protein_per_100g: selectedResult.per100.protein_g,
            carbs_per_100g: selectedResult.per100.carbs_g,
            fats_per_100g: selectedResult.per100.fats_g,
            serving_g: defaultServing,
          }),
        }).catch(() => {/* non-critical */})
      }

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
    setLogs(prev => {
      const updated = prev.filter(l => l.id !== id)
      foodCache.set(viewDate, updated)
      return updated
    })
    setDeletingId(null)
  }

  function startEdit(item: FoodLog) {
    setEditingId(item.id)
    setEditForm({
      name: item.name,
      meal_type: (MEAL_TYPES.includes(item.meal_type as MealType) ? item.meal_type : 'snack') as MealType,
      calories: item.calories !== null ? String(item.calories) : '',
      protein_g: item.protein_g !== null ? String(item.protein_g) : '',
      carbs_g: item.carbs_g !== null ? String(item.carbs_g) : '',
      fats_g: item.fats_g !== null ? String(item.fats_g) : '',
    })
  }

  async function saveEdit(id: string) {
    if (!editForm.name.trim()) return
    setSavingEdit(true)
    const res = await window.fetch(`/api/food/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name.trim(),
        meal_type: editForm.meal_type,
        calories: num(editForm.calories),
        protein_g: num(editForm.protein_g),
        carbs_g: num(editForm.carbs_g),
        fats_g: num(editForm.fats_g),
      }),
    })
    if (res.ok) {
      const updated: FoodLog = await res.json()
      setLogs(prev => {
        const next = prev.map(l => l.id === id ? updated : l)
        foodCache.set(viewDate, next)
        return next
      })
      setEditingId(null)
    }
    setSavingEdit(false)
  }

  async function generateMealPlan() {
    setGeneratingPlan(true)
    setMealPlan(null)
    setMealPlanError(null)
    setAddedMeals(new Set())
    setShowMealPlan(true)
    try {
      const res = await window.fetch('/api/ai/meal-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_training_day: isTrainingDay,
          current_hour: new Date().getHours(),
          already_logged: logs.map(l => ({
            meal_type: l.meal_type,
            name: l.name,
            calories: l.calories ?? 0,
            protein_g: l.protein_g ?? 0,
            carbs_g: l.carbs_g ?? 0,
            fats_g: l.fats_g ?? 0,
          })),
        }),
      })
      if (res.status === 429) {
        setMealPlanError('Too many requests — wait a few minutes and try again.')
        return
      }
      const plan = await res.json() as MealPlan
      if (!res.ok || !Array.isArray(plan.meals)) {
        setMealPlanError('Couldn\'t generate a plan right now. Try again.')
        return
      }
      setMealPlan(plan)
    } catch {
      setMealPlanError('Couldn\'t generate a plan right now. Try again.')
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
        date: viewDate,
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
      setLogs(prev => {
        const updated = [...prev, logged]
        foodCache.set(viewDate, updated)
        return updated
      })
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-muted-foreground text-sm tracking-widest uppercase">
            {isToday ? 'Today' : 'Past Day'}
          </p>
          <DayNav date={viewDate} todayStr={todayStr} basePath="/food" />
        </div>
        <div className="flex items-center gap-2">
          {isToday && (
            <button
              onClick={generateMealPlan}
              title="Generate AI meal plan"
              className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 hover:bg-orange-500/20 transition-all duration-200"
            >
              <Sparkles size={16} />
            </button>
          )}
          <button
            onClick={() => showForm ? closeForm() : setShowForm(true)}
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200',
              showForm
                ? 'bg-muted text-muted-foreground'
                : 'bg-orange-500 text-primary-foreground hover:bg-orange-400',
            )}
          >
            {showForm ? <X size={18} /> : <Plus size={18} strokeWidth={2.5} />}
          </button>
        </div>
      </div>

      {/* Morning insight */}
      {isToday && (
        <div className="mb-4">
          <PageInsightBanner page="food" />
        </div>
      )}

      {/* Daily Totals */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed size={13} className="text-orange-400" />
            <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">{dateLabel}</span>
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
              <span className="text-muted-foreground/60 text-xs">/ {calorieTarget.toLocaleString()} kcal</span>
            </div>
            <span className={cn('text-xs font-semibold', calPct >= 90 ? 'text-green-400' : 'text-muted-foreground')}>
              {totals.calories > 0 ? `${calPct}%` : '0%'}
            </span>
          </div>
          <div className="w-full bg-muted/50 rounded-full h-1.5">
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
                <p className={cn('font-condensed text-xl font-bold leading-none', value > 0 ? color : 'text-muted-foreground/40')}>
                  {value > 0 ? `${Math.round(value)}` : '—'}
                  {value > 0 && <span className="text-[10px] font-normal text-muted-foreground/60 ml-0.5">g</span>}
                </p>
                <p className="text-muted-foreground/60 text-[10px] mt-1 font-medium">{label}</p>
                {pct !== null && value > 0 && (
                  <div className="w-full bg-muted/50 rounded-full h-0.5 mt-1.5">
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
        <div ref={formRef} className="bg-card border border-border rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold shrink-0">Add Food</p>
            {/* Tab switcher + close */}
            <div className="flex items-center gap-1.5 ml-auto">
            <div className="flex bg-white/[0.04] rounded-lg p-0.5 gap-0.5">
              <button
                type="button"
                onClick={() => { setFormTab('search'); setCustomForm(EMPTY_CUSTOM); setCustomSaved(false) }}
                className={cn(
                  'text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all',
                  formTab === 'search' ? 'bg-orange-500 text-primary-foreground' : 'text-muted-foreground hover:text-foreground/80',
                )}
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => { setFormTab('photo'); clearSelection(); setAiEstimated(false); setAiNotes(null); clearPhotos() }}
                className={cn(
                  'flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all',
                  formTab === 'photo' ? 'bg-orange-500 text-primary-foreground' : 'text-muted-foreground hover:text-foreground/80',
                )}
              >
                <Camera size={10} />
                Photo
              </button>
              <button
                type="button"
                onClick={() => { setFormTab('create'); clearSelection() }}
                className={cn(
                  'flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all',
                  formTab === 'create' ? 'bg-orange-500 text-primary-foreground' : 'text-muted-foreground hover:text-foreground/80',
                )}
              >
                <BookmarkPlus size={10} />
                Custom
              </button>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground/80 hover:bg-white/[0.06] transition-all shrink-0"
              aria-label="Close"
            >
              <X size={13} />
            </button>
            </div>
          </div>

          {formTab === 'photo' ? (
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground/60">Add one or more photos — AI estimates combined macros.</p>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addPhotoFiles(e.target.files); e.target.value = '' }}
              />

              {/* Thumbnails */}
              {photoPreviews.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {photoPreviews.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/[0.08] shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-background/70 flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {/* Add more button */}
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border border-dashed border-white/[0.10] flex flex-col items-center justify-center gap-1 text-muted-foreground/60 hover:text-muted-foreground hover:border-white/20 transition-all shrink-0"
                  >
                    <Plus size={16} strokeWidth={2} />
                    <span className="text-[9px]">Add</span>
                  </button>
                </div>
              )}

              {/* Empty drop zone */}
              {photoPreviews.length === 0 && (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full h-28 bg-white/[0.03] border border-dashed border-white/[0.10] rounded-2xl flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground/80 hover:border-orange-500/40 hover:bg-orange-500/[0.04] transition-all"
                >
                  <Camera size={20} className="text-orange-400" />
                  <span className="text-xs font-medium">Tap to add photos</span>
                  <span className="text-[10px] text-muted-foreground/40">JPG, PNG, WEBP · multiple OK</span>
                </button>
              )}

              {/* Description input */}
              <input
                type="text"
                placeholder="Add context… e.g. 'large portion, ate about half'"
                value={photoDesc}
                onChange={e => setPhotoDesc(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-orange-500/50 transition-colors"
              />

              <button
                type="button"
                onClick={analyzePhotos}
                disabled={analyzing || photoFiles.length === 0}
                className="w-full bg-orange-500 text-primary-foreground font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-orange-400 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {analyzing ? (
                  <><Loader2 size={14} className="animate-spin" /> Analyzing {photoFiles.length > 1 ? `${photoFiles.length} photos` : 'photo'}…</>
                ) : (
                  <><Sparkles size={14} /> Analyse{photoFiles.length > 1 ? ` ${photoFiles.length} Photos` : ' Photo'}</>
                )}
              </button>
            </div>
          ) : formTab === 'search' ? (
            <form onSubmit={submit} className="space-y-3">
              {/* Search bar */}
              {!selectedResult ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search food database…"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-orange-500/50 transition-colors"
                      autoFocus
                    />
                    {searching && (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 animate-spin" />
                    )}
                  </div>

                  {/* Recent foods (shown when not searching) */}
                  {showRecent && (
                    <div>
                      <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold px-1 mb-1.5">Recent</p>
                      <div className="bg-background border border-border rounded-xl overflow-hidden">
                        {recentFoods.map((r, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => pickRecent(r)}
                            className="w-full text-left px-3 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-b-0"
                          >
                            <p className="text-sm text-foreground truncate leading-snug">{r.name}</p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
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
                    <div className="bg-background border border-border rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                      {searchResults.map((r, i) => (
                        <button
                          key={r.code ?? i}
                          type="button"
                          onClick={() => pickResult(r)}
                          className="w-full text-left px-3 py-2.5 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-b-0"
                        >
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm text-foreground truncate leading-snug flex-1">{r.name}</p>
                            {r.source === 'custom' && (
                              <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded-full">Mine</span>
                            )}
                            {r.source === 'usda' && (
                              <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded-full">USDA</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                            {[
                              r.brand,
                              r.per100.calories !== null && `${Math.round(r.per100.calories)} kcal`,
                              r.per100.protein_g !== null && `${r1(r.per100.protein_g)}g P`,
                              r.per100.carbs_g !== null && `${r1(r.per100.carbs_g)}g C`,
                              r.per100.fats_g !== null && `${r1(r.per100.fats_g)}g F`,
                            ].filter(Boolean).join(' · ')}
                            <span className="text-muted-foreground/40"> per 100g</span>
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                    <p className="text-muted-foreground/40 text-xs px-1">
                      No results — fill in manually below or{' '}
                      <button type="button" className="text-orange-500 underline" onClick={() => { setFormTab('create'); setCustomForm(f => ({ ...f, name: searchQuery })) }}>
                        create a custom food
                      </button>
                    </p>
                  )}

                  {/* Manual name entry divider */}
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-white/[0.04]" />
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">or enter manually</span>
                    <div className="h-px flex-1 bg-white/[0.04]" />
                  </div>

                  <input
                    type="text"
                    placeholder="Food name"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              ) : (
                /* Selected food — serving size adjuster */
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground leading-snug truncate">{selectedResult.name}</p>
                        {selectedResult.source === 'custom' && (
                          <Star size={11} className="text-orange-400 shrink-0 fill-orange-400" />
                        )}
                      </div>
                      {selectedResult.brand && (
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">{selectedResult.brand}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 mt-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Serving size + unit toggle */}
                  <div className="flex items-center gap-2 mt-3">
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold shrink-0">Serving</p>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0.1"
                      step="any"
                      value={servingG}
                      onChange={e => setServingG(e.target.value)}
                      className="w-20 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1 text-sm text-foreground/90 outline-none focus:border-orange-500/50 transition-colors text-center"
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
                            servingUnit === u ? 'bg-orange-500 text-primary-foreground' : 'text-muted-foreground hover:text-foreground/80',
                          )}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                    <span className="text-muted-foreground/40 text-[10px] ml-auto">
                      {selectedResult.per100.calories !== null && `${Math.round(selectedResult.per100.calories)} kcal/100g`}
                    </span>
                  </div>
                </div>
              )}

              {/* AI estimate banner */}
              {aiEstimated && (
                <div className="flex items-start gap-2.5 bg-orange-500/[0.07] border border-orange-500/20 rounded-xl px-3 py-2.5">
                  <Camera size={13} className="text-orange-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-orange-300">AI estimate — review before logging</p>
                    {aiNotes && <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{aiNotes}</p>}
                  </div>
                  <button type="button" onClick={() => { setAiEstimated(false); setAiNotes(null) }} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0 mt-0.5"><X size={12} /></button>
                </div>
              )}

              {/* Meal type */}
              <div className="relative">
                <select
                  value={form.meal_type}
                  onChange={e => setForm(p => ({ ...p, meal_type: e.target.value as MealType }))}
                  className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-foreground/80 outline-none focus:border-orange-500/50 transition-colors pr-8"
                >
                  {MEAL_TYPES.map(t => (
                    <option key={t} value={t}>{MEAL_LABELS[t]}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
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
                    <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-1 px-1">{label}</p>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 py-2 text-sm text-foreground/80 placeholder-muted-foreground/40 outline-none focus:border-orange-500/50 transition-colors text-center"
                    />
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={saving || (!form.name.trim() && !selectedResult)}
                className="w-full bg-orange-500 text-primary-foreground font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-orange-400 transition-colors active:scale-[0.98]"
              >
                {saving ? 'Adding…' : 'Add to Log'}
              </button>
            </form>
          ) : (
            /* Create custom food tab */
            <div className="space-y-3">
              <p className="text-[10px] text-muted-foreground/60">Save a food once — it&apos;ll appear in your personal search results.</p>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-1 px-1">Food Name *</p>
                  <input
                    type="text"
                    placeholder="e.g. My Protein Shake"
                    value={customForm.name}
                    onChange={e => setCustomForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-orange-500/50 transition-colors"
                    autoFocus
                  />
                </div>
                <div className="col-span-2">
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-1 px-1">Brand (optional)</p>
                  <input
                    type="text"
                    placeholder="Brand name"
                    value={customForm.brand}
                    onChange={e => setCustomForm(p => ({ ...p, brand: e.target.value }))}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground/40 outline-none focus:border-orange-500/50 transition-colors"
                  />
                </div>
              </div>

              <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider font-semibold px-1">Macros per 100g</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { key: 'calories_per_100g' as const, label: 'Cal' },
                  { key: 'protein_per_100g' as const, label: 'Protein' },
                  { key: 'carbs_per_100g' as const, label: 'Carbs' },
                  { key: 'fats_per_100g' as const, label: 'Fat' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-1 px-1">{label}</p>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={customForm[key]}
                      onChange={e => setCustomForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 py-2 text-sm text-foreground/80 placeholder-muted-foreground/40 outline-none focus:border-orange-500/50 transition-colors text-center"
                    />
                  </div>
                ))}
              </div>

              <div>
                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-1 px-1">Default Serving (g)</p>
                <input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="any"
                  value={customForm.serving_g}
                  onChange={e => setCustomForm(p => ({ ...p, serving_g: e.target.value }))}
                  className="w-28 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-foreground/80 outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={saveCustomFood}
                disabled={savingCustom || !customForm.name.trim()}
                className="w-full bg-orange-500 text-primary-foreground font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:bg-orange-400 transition-colors active:scale-[0.98]"
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
            <div key={i} className="h-16 bg-card rounded-2xl animate-pulse" />
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
                      <span className="text-muted-foreground/60 text-[10px] font-medium">{groupCals} kcal</span>
                    )}
                    <button
                      onClick={() => openFormForMeal(type)}
                      className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.10] transition-all"
                      title={`Add to ${MEAL_LABELS[type]}`}
                    >
                      <Plus size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {items.length === 0 ? (
                  <button
                    onClick={() => openFormForMeal(type)}
                    className="w-full bg-card/60 border border-dashed border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-2 text-muted-foreground/40 hover:text-muted-foreground hover:border-white/[0.10] transition-all"
                  >
                    <Plus size={13} strokeWidth={2} />
                    <span className="text-xs">Add {MEAL_LABELS[type].toLowerCase()}</span>
                  </button>
                ) : (
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.id} className="bg-card border border-border rounded-2xl overflow-hidden">
                        {editingId === item.id ? (
                          <div className="px-4 py-3 space-y-2.5">
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-orange-500/50 transition-colors"
                              autoFocus
                            />
                            <div className="relative">
                              <select
                                value={editForm.meal_type}
                                onChange={e => setEditForm(p => ({ ...p, meal_type: e.target.value as MealType }))}
                                className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-foreground/80 outline-none focus:border-orange-500/50 transition-colors pr-8"
                              >
                                {MEAL_TYPES.map(t => (
                                  <option key={t} value={t}>{MEAL_LABELS[t]}</option>
                                ))}
                              </select>
                              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { key: 'calories' as const, label: 'Cal' },
                                { key: 'protein_g' as const, label: 'Protein' },
                                { key: 'carbs_g' as const, label: 'Carbs' },
                                { key: 'fats_g' as const, label: 'Fat' },
                              ].map(({ key, label }) => (
                                <div key={key}>
                                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-1 px-1">{label}</p>
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="any"
                                    value={editForm[key]}
                                    onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-2 py-2 text-sm text-foreground/80 placeholder-muted-foreground/40 outline-none focus:border-orange-500/50 transition-colors text-center"
                                  />
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(item.id)}
                                disabled={savingEdit || !editForm.name.trim()}
                                className="flex-1 bg-orange-500 text-primary-foreground font-bold py-2 rounded-xl text-sm disabled:opacity-40 hover:bg-orange-400 transition-colors"
                              >
                                {savingEdit ? 'Saving…' : 'Save'}
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="w-10 flex items-center justify-center rounded-xl bg-white/[0.04] text-muted-foreground hover:text-foreground/80 transition-colors"
                              >
                                <X size={15} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="px-4 py-3 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                              <p className="text-muted-foreground/60 text-xs mt-0.5">
                                {[
                                  item.calories !== null && `${item.calories} kcal`,
                                  item.protein_g !== null && `${item.protein_g}g P`,
                                  item.carbs_g !== null && `${item.carbs_g}g C`,
                                  item.fats_g !== null && `${item.fats_g}g F`,
                                ].filter(Boolean).join(' · ') || 'No macros logged'}
                              </p>
                            </div>
                            <button
                              onClick={() => startEdit(item)}
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground/40 hover:text-foreground/80 hover:bg-white/[0.06] transition-all duration-150 shrink-0"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => remove(item.id)}
                              disabled={deletingId === item.id}
                              className="w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-all duration-150 shrink-0 disabled:opacity-40"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
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
          className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMealPlan(false) }}
        >
          <div className="bg-background border-t border-border rounded-t-3xl max-h-[88dvh] flex flex-col">
            {/* Sheet header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-orange-400" />
                <span className="text-sm font-bold text-foreground">
                  {mealPlan && (mealPlan.already_logged_calories ?? 0) > 0 ? 'What to eat next' : 'Today\'s Meal Plan'}
                </span>
              </div>
              <button onClick={() => setShowMealPlan(false)} className="text-muted-foreground hover:text-foreground/80 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Sheet body */}
            <div className="overflow-y-auto p-4 flex-1 space-y-3">
              {generatingPlan ? (
                <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                  <Loader2 size={22} className="text-orange-400 animate-spin" />
                  <span className="text-sm">Generating your personalised plan…</span>
                </div>
              ) : mealPlanError ? (
                <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                  <span className="text-sm text-center">{mealPlanError}</span>
                  <button onClick={generateMealPlan} className="text-xs text-orange-400 hover:text-orange-300 transition-colors">Try again</button>
                </div>
              ) : mealPlan ? (
                <>
                  {/* Context banner when there are already-logged meals */}
                  {(mealPlan.already_logged_calories ?? 0) > 0 && (
                    <div className="text-xs text-muted-foreground pb-1">
                      Already eaten: <span className="text-foreground/80 font-medium">{mealPlan.already_logged_calories} kcal · {mealPlan.already_logged_protein_g}g protein</span>
                    </div>
                  )}

                  {/* Totals pills */}
                  <div className="flex gap-2 flex-wrap">
                    {mealPlan.meals.length === 0 ? (
                      <div className="text-sm text-muted-foreground py-2">You&apos;ve hit your targets for today. Great work!</div>
                    ) : [
                      { label: 'kcal remaining', value: mealPlan.total_calories },
                      { label: 'protein remaining', value: `${mealPlan.total_protein_g}g` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-card border border-border rounded-xl px-3 py-1.5 text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{value}</span> {label}
                      </div>
                    ))}
                  </div>

                  {/* Meal items */}
                  <div className="space-y-2.5">
                    {(mealPlan.meals ?? []).map((item, idx) => {
                      const added = addedMeals.has(idx)
                      const adding = addingMealIdx === idx
                      const MEAL_DOT_CLASS: Record<string, string> = {
                        breakfast: 'bg-amber-400', lunch: 'bg-green-400',
                        dinner: 'bg-blue-400', snack: 'bg-muted',
                      }
                      return (
                        <div key={idx} className={cn('bg-card border border-border rounded-2xl p-3.5 transition-opacity', added && 'opacity-50')}>
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', MEAL_DOT_CLASS[item.meal_type] ?? 'bg-muted')} />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{item.meal_type}</span>
                                <span className="text-[10px] text-muted-foreground/40">· {item.prep_note}</span>
                              </div>
                              <p className="text-sm font-semibold text-foreground mb-1">{item.name}</p>
                              <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{item.description}</p>
                              <div className="flex gap-2">
                                {[
                                  { label: 'P', value: item.protein_g, color: 'text-orange-400' },
                                  { label: 'C', value: item.carbs_g, color: 'text-yellow-400' },
                                  { label: 'F', value: item.fats_g, color: 'text-blue-400' },
                                ].map(({ label, value, color }) => (
                                  <span key={label} className="text-[11px] text-muted-foreground">
                                    <span className={cn('font-bold', color)}>{value}</span>{label}
                                  </span>
                                ))}
                                <span className="text-[11px] text-muted-foreground/40">{item.calories} kcal</span>
                              </div>
                            </div>
                            <button
                              onClick={() => !added && addMealToLog(item, idx)}
                              disabled={added || adding}
                              className={cn(
                                'w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border transition-all duration-150',
                                added
                                  ? 'bg-green-500/10 border-green-500/20'
                                  : 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20',
                              )}
                            >
                              {adding ? (
                                <Loader2 size={13} className="text-orange-400 animate-spin" />
                              ) : added ? (
                                <Check size={13} className="text-green-400" />
                              ) : (
                                <Plus size={13} className="text-orange-400" />
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
                    className="w-full bg-transparent border border-border rounded-xl py-2.5 text-sm text-muted-foreground hover:text-foreground/80 hover:border-white/15 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={12} /> Generate new plan
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default FoodContent

'use client'

import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { todayLocal } from '@/lib/date'

// Session-level cache keyed by date string. Evicted on any mutation so stale
// data never lingers, but navigating back to an already-viewed date is instant.
const foodCache = new Map<string, FoodLog[]>()
import {
  UtensilsCrossed, Plus, Trash2, ChevronDown, X, Search, Loader2, Star,
  BookmarkPlus, Sparkles, Check, Pencil, Camera, MoreHorizontal, Copy,
  ChevronRight, Droplets,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FoodLog } from '@/lib/types'
import { DayNav } from '@/components/day-nav'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = typeof MEAL_TYPES[number]

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
}

const MEAL_COLORS: Record<MealType, { dot: string }> = {
  breakfast: { dot: 'bg-amber-400' },
  lunch: { dot: 'bg-green-400' },
  dinner: { dot: 'bg-blue-400' },
  snack: { dot: 'bg-muted' },
}

const MEAL_TIME_HINTS: Record<MealType, string> = {
  breakfast: 'Suggested: before 10AM',
  lunch: 'Suggested: 12–2PM',
  dinner: 'Suggested: before 8:30PM',
  snack: 'Suggested: 6PM (training days)',
}

const QUICK_FAVOURITES = [
  { name: "Nando's PERi-Veg + halloumi", protein_g: 40, calories: 650, carbs_g: 65, fats_g: 22, meal_type: 'lunch' as MealType },
  { name: "Burro Blanco Beyond Meat bowl", protein_g: 45, calories: 720, carbs_g: 70, fats_g: 24, meal_type: 'lunch' as MealType },
  { name: "Pepe's 2× paneer wraps", protein_g: 38, calories: 580, carbs_g: 62, fats_g: 20, meal_type: 'lunch' as MealType },
  { name: "Ghost Whey shake 1.5 scoops", protein_g: 37, calories: 195, carbs_g: 8, fats_g: 3, meal_type: 'snack' as MealType },
  { name: "Greek yoghurt + whey scoop", protein_g: 42, calories: 380, carbs_g: 28, fats_g: 6, meal_type: 'snack' as MealType },
  { name: "3 scrambled eggs + feta on sourdough", protein_g: 29, calories: 420, carbs_g: 35, fats_g: 18, meal_type: 'breakfast' as MealType },
]

const DINNER_SUGGESTIONS = [
  { name: 'Saag paneer + dal', hint: '~31g P' },
  { name: 'Red lentil soup + 2 fried eggs', hint: '~28g P' },
  { name: 'Tofu stir-fry + brown rice', hint: '~32g P' },
]

const SNACK_SUGGESTIONS = [
  { name: 'Cottage cheese 200g + walnuts', hint: '~26g P' },
  { name: 'Greek yoghurt + 1 scoop whey', hint: '~42g P' },
]

const OZ_PER_G = 1 / 28.3495

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

function calBarColor(currentCal: number, targetCal: number, hourNow: number): string {
  const gap = targetCal - currentCal
  if (gap <= 200) return '#22C55E'
  if (gap > 400 && hourNow >= 18) return '#F59E0B'
  return '#F97316'
}

function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── WaterTracker ──────────────────────────────────────────────────────────────
function WaterTracker({ todayStr }: { todayStr: string }) {
  const key = `apex_water_${todayStr}`
  const [cups, setCups] = useState<number>(() => {
    try { const v = localStorage.getItem(key); return v ? parseInt(v, 10) : 0 } catch { return 0 }
  })

  function toggle(i: number) {
    const next = i < cups ? i : i + 1
    setCups(next)
    try { localStorage.setItem(key, String(next)) } catch {}
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Droplets size={11} className="text-blue-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Hydration · target 3L</span>
        </div>
        <span className="text-[10px] text-muted-foreground/50">{(cups * 0.5).toFixed(1)}L / 3L</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              'w-6 h-6 rounded-full border-2 transition-all duration-150',
              i < cups ? 'bg-blue-500 border-blue-400' : 'bg-transparent border-white/20 hover:border-blue-400/50',
            )}
            aria-label={`${((i + 1) * 500)}ml`}
          />
        ))}
      </div>
    </div>
  )
}

// ── YesterdayStrip ────────────────────────────────────────────────────────────
function YesterdayStrip({ proteinTarget, todayStr }: { proteinTarget: number; todayStr: string }) {
  const [stats, setStats] = useState<{ protein_g: number; calories: number } | null>(null)

  useEffect(() => {
    const d = new Date(todayStr + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    const yesterday = d.toISOString().split('T')[0]
    fetch(`/api/food?date=${yesterday}`)
      .then(r => r.json())
      .then((data: FoodLog[]) => {
        const p = Math.round(data.reduce((s, l) => s + (l.protein_g ?? 0), 0))
        const c = Math.round(data.reduce((s, l) => s + (l.calories ?? 0), 0))
        if (p > 0 || c > 0) setStats({ protein_g: p, calories: c })
      })
      .catch(() => {})
  }, [todayStr])

  if (!stats) return null

  const pct = Math.round((stats.protein_g / proteinTarget) * 100)
  const badgeCls = pct >= 90
    ? 'bg-green-500/20 text-green-400'
    : pct >= 70
    ? 'bg-amber-500/20 text-amber-400'
    : 'bg-red-500/20 text-red-400'

  return (
    <div className="flex items-center gap-2 mb-4 py-2 border-t border-white/[0.05] px-1">
      <span className="text-[12px] text-muted-foreground/50 shrink-0">Yesterday</span>
      <span className="text-[13px] text-foreground/75">{stats.protein_g}g protein · {stats.calories.toLocaleString()} kcal</span>
      <span className={cn('ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0', badgeCls)}>{pct}% of target</span>
    </div>
  )
}

// ── FoodTipCard ───────────────────────────────────────────────────────────────
function FoodTipCard({ proteinGap, onLogFood }: { proteinGap: number; onLogFood: (name: string) => void }) {
  const [tip, setTip] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(true)
  const today = todayLocal()
  const dismissKey = `apex_food_tip_v2_${today}`

  useEffect(() => {
    try { if (localStorage.getItem(dismissKey)) { setVisible(false); setLoading(false); return } } catch {}
    let cancelled = false
    fetch('/api/ai-tip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ page: 'food' }) })
      .then(r => r.json())
      .then((d: { tip: string }) => { if (!cancelled) setTip(d.tip) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null

  function renderBody(raw: string) {
    const lines = raw.split('\n').filter(Boolean)
    // Drop first line if it looks like an all-caps header
    let body = lines
    if (lines.length > 0) {
      const first = lines[0].replace(/\*\*/g, '').trim()
      if (first.length > 8 && first === first.toUpperCase()) body = lines.slice(1)
    }
    const truncated = body.slice(0, 3).join(' ')
    // Parse **bold** and 'single-quoted' text as food mentions
    const parts = truncated.split(/(\*\*[^*]+\*\*|'[^']+')/g)
    return (
      <span className="text-[12px] text-foreground/70 leading-relaxed">
        {parts.map((part, j) => {
          if (j % 2 === 1) {
            const food = part.replace(/\*\*/g, '').replace(/'/g, '')
            return (
              <span key={j}>
                {food}
                <button
                  onClick={() => onLogFood(food)}
                  className="inline-flex items-center ml-1 px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400 text-[10px] font-medium hover:bg-amber-500/10 transition-colors leading-none"
                >
                  + Log
                </button>
              </span>
            )
          }
          return <span key={j}>{part}</span>
        })}
      </span>
    )
  }

  return (
    <div className="bg-orange-500/[0.07] border border-orange-500/15 rounded-2xl p-3.5 mb-4">
      <div className="flex items-start gap-2.5">
        <Sparkles size={12} className="text-orange-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-foreground/90 mb-1.5">
            {proteinGap > 0
              ? `You're ${proteinGap}g short — here's how to close it`
              : 'Protein target met — here\'s what else to focus on'}
          </p>
          {loading ? (
            <div className="space-y-1.5">
              <div className="h-2.5 bg-white/10 rounded animate-pulse w-full" />
              <div className="h-2.5 bg-white/10 rounded animate-pulse w-4/5" />
            </div>
          ) : tip ? renderBody(tip) : null}
        </div>
        {!loading && (
          <button
            onClick={() => { try { localStorage.setItem(dismissKey, '1') } catch {} setVisible(false) }}
            className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

// ── Interfaces ────────────────────────────────────────────────────────────────
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

// ── Main component ────────────────────────────────────────────────────────────
const FoodContent = memo(function FoodContent({
  proteinTarget,
  calorieTarget,
  isTrainingDay = false,
  viewDate: viewDateProp,
  todayStr: todayStrProp,
}: FoodContentProps) {
  const todayStr = todayStrProp ?? todayLocal()
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

  // Only the setter is used (to force a re-render); the canonical value lives in the ref.
  const [, setPendingRatingIds] = useState<Set<string>>(new Set())
  const pendingRatingIdsRef = useRef<Set<string>>(new Set())

  const [showMealPlan, setShowMealPlan] = useState(false)
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null)
  const [mealPlanError, setMealPlanError] = useState<string | null>(null)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [addedMeals, setAddedMeals] = useState<Set<number>>(new Set())
  const [addingMealIdx, setAddingMealIdx] = useState<number | null>(null)

  const [formTab, setFormTab] = useState<FormTab>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null)

  const [servingG, setServingG] = useState('100')
  const [servingUnit, setServingUnit] = useState<ServingUnit>('g')

  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([])
  const [recentLoaded, setRecentLoaded] = useState(false)

  const [customForm, setCustomForm] = useState<CustomFoodForm>(EMPTY_CUSTOM)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customSaved, setCustomSaved] = useState(false)

  const [analyzing, setAnalyzing] = useState(false)
  const [aiEstimated, setAiEstimated] = useState(false)
  const [aiNotes, setAiNotes] = useState<string | null>(null)
  const [photoFiles, setPhotoFiles] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [photoDesc, setPhotoDesc] = useState('')
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  // New state
  const [openOverflowId, setOpenOverflowId] = useState<string | null>(null)
  const [kitchenWarnDismissed, setKitchenWarnDismissed] = useState(false)
  const [showFavourites, setShowFavourites] = useState(false)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const formRef = useRef<HTMLDivElement | null>(null)

  // Close overflow on outside click
  useEffect(() => {
    if (!openOverflowId) return
    const close = () => setOpenOverflowId(null)
    const id = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(id); document.removeEventListener('click', close) }
  }, [openOverflowId])

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
      const staleMissingRatings = cached.length > 0 &&
        cached.some(l => l.meal_rating === null && !pendingRatingIdsRef.current.has(l.id))
      if (!staleMissingRatings) {
        setLogs(cached)
        setLoading(false)
        return
      }
      foodCache.delete(viewDate)
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

  useEffect(() => {
    if (!showForm || recentLoaded) return
    window.fetch('/api/food/recent')
      .then(r => r.json())
      .then(data => { setRecentFoods(data); setRecentLoaded(true) })
      .catch(() => setRecentLoaded(true))
  }, [showForm, recentLoaded])

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (searchQuery.length < 2) {
      searchTimer.current = setTimeout(() => { setSearchResults([]) }, 0)
      return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
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
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [searchQuery])

  useEffect(() => {
    if (!selectedResult) return
    const g = servingUnit === 'oz' ? parseFloat(servingG) / OZ_PER_G : parseFloat(servingG)
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
    setShowFavourites(false)
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
    const currentG = servingUnit === 'oz' ? parseFloat(servingG) / OZ_PER_G : parseFloat(servingG)
    setServingUnit(unit)
    if (!isNaN(currentG)) {
      setServingG(unit === 'oz' ? r1(currentG * OZ_PER_G).toString() : String(Math.round(currentG)))
    }
  }

  async function rateMealAsync(item: FoodLog, force = false) {
    pendingRatingIdsRef.current = new Set(pendingRatingIdsRef.current).add(item.id)
    setPendingRatingIds(pendingRatingIdsRef.current)
    try {
      const mealContext = logs
        .filter(l => l.meal_type === item.meal_type && l.id !== item.id)
        .map(l => ({ name: l.name, calories: l.calories, protein_g: l.protein_g, carbs_g: l.carbs_g, fats_g: l.fats_g }))
      const rateRes = await window.fetch('/api/ai/rate-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name, meal_type: item.meal_type, calories: item.calories,
          protein_g: item.protein_g, carbs_g: item.carbs_g, fats_g: item.fats_g,
          meal_context: mealContext, ...(force && { force: true }),
        }),
      })
      if (!rateRes.ok) return
      const { rating, suggestions } = await rateRes.json()
      await window.fetch(`/api/food/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_rating: rating, meal_suggestions: suggestions }),
      })
      setLogs(prev => {
        const updated = prev.map(l => l.id === item.id ? { ...l, meal_rating: rating, meal_suggestions: suggestions } : l)
        foodCache.set(viewDate, updated)
        return updated
      })
    } catch { /* non-critical */ } finally {
      const s = new Set(pendingRatingIdsRef.current)
      s.delete(item.id)
      pendingRatingIdsRef.current = s
      setPendingRatingIds(s)
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
        date: viewDate, meal_type: form.meal_type, name: form.name.trim(),
        calories: num(form.calories), protein_g: num(form.protein_g),
        carbs_g: num(form.carbs_g), fats_g: num(form.fats_g),
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
      rateMealAsync(item)
      if (selectedResult && selectedResult.source !== 'custom') {
        const g = servingUnit === 'oz' ? parseFloat(servingG) / OZ_PER_G : parseFloat(servingG)
        const defaultServing = isNaN(g) || g <= 0 ? (selectedResult.serving_g ?? 100) : g
        window.fetch('/api/food/custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: selectedResult.name, brand: selectedResult.brand ?? null,
            calories_per_100g: selectedResult.per100.calories, protein_per_100g: selectedResult.per100.protein_g,
            carbs_per_100g: selectedResult.per100.carbs_g, fats_per_100g: selectedResult.per100.fats_g,
            serving_g: defaultServing,
          }),
        }).catch(() => {})
      }
      const keepMeal = form.meal_type
      clearSelection()
      setForm({ ...EMPTY_FORM, meal_type: keepMeal })
      // Dismiss kitchen warning if dinner was just logged
      if (keepMeal === 'dinner') setKitchenWarnDismissed(true)
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
        name: customForm.name.trim(), brand: customForm.brand.trim() || null,
        calories_per_100g: num(customForm.calories_per_100g), protein_per_100g: num(customForm.protein_per_100g),
        carbs_per_100g: num(customForm.carbs_per_100g), fats_per_100g: num(customForm.fats_per_100g),
        serving_g: num(customForm.serving_g) ?? 100,
      }),
    })
    if (res.ok) {
      setCustomSaved(true)
      const saved = await res.json()
      const serving = saved.serving_g ?? 100
      const per100 = { calories: saved.calories_per_100g, protein_g: saved.protein_per_100g, carbs_g: saved.carbs_per_100g, fats_g: saved.fats_per_100g }
      setFormTab('search')
      setCustomForm(EMPTY_CUSTOM)
      pickResult({ code: `custom:${saved.id}`, name: saved.name, brand: saved.brand, serving_g: serving, per100, source: 'custom' })
    }
    setSavingCustom(false)
  }

  function openFormForMeal(meal: MealType, prefillName?: string) {
    clearSelection()
    setForm({ ...EMPTY_FORM, meal_type: meal, name: prefillName ?? '' })
    setFormTab('search')
    setShowFavourites(!prefillName)
    setShowForm(true)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function handleLogFoodFromTip(foodName: string) {
    clearSelection()
    setForm({ ...EMPTY_FORM, meal_type: 'dinner', name: foodName })
    setFormTab('search')
    setShowFavourites(false)
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
    setOpenOverflowId(null)
  }

  async function duplicate(item: FoodLog) {
    const res = await window.fetch('/api/food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: viewDate, meal_type: item.meal_type, name: item.name,
        calories: item.calories, protein_g: item.protein_g,
        carbs_g: item.carbs_g, fats_g: item.fats_g,
      }),
    })
    if (res.ok) {
      const logged: FoodLog = await res.json()
      foodCache.delete(viewDate)
      setLogs(prev => {
        const updated = [...prev, logged]
        foodCache.set(viewDate, updated)
        return updated
      })
      rateMealAsync(logged)
    }
    setOpenOverflowId(null)
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
    setOpenOverflowId(null)
  }

  async function saveEdit(id: string) {
    if (!editForm.name.trim()) return
    setSavingEdit(true)
    const res = await window.fetch(`/api/food/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name.trim(), meal_type: editForm.meal_type,
        calories: num(editForm.calories), protein_g: num(editForm.protein_g),
        carbs_g: num(editForm.carbs_g), fats_g: num(editForm.fats_g),
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
            meal_type: l.meal_type, name: l.name, calories: l.calories ?? 0,
            protein_g: l.protein_g ?? 0, carbs_g: l.carbs_g ?? 0, fats_g: l.fats_g ?? 0,
          })),
        }),
      })
      if (res.status === 429) { setMealPlanError('Too many requests — wait a few minutes and try again.'); return }
      const plan = await res.json() as MealPlan
      if (!res.ok || !Array.isArray(plan.meals)) { setMealPlanError('Couldn\'t generate a plan right now. Try again.'); return }
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
        date: viewDate, meal_type: item.meal_type, name: item.name,
        calories: item.calories, protein_g: item.protein_g,
        carbs_g: item.carbs_g, fats_g: item.fats_g,
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

  // ── Derived values ─────────────────────────────────────────────────────────
  const totals = logs.reduce(
    (acc, l) => ({
      calories: acc.calories + (l.calories ?? 0),
      protein_g: acc.protein_g + (l.protein_g ?? 0),
      carbs_g: acc.carbs_g + (l.carbs_g ?? 0),
      fats_g: acc.fats_g + (l.fats_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
  )

  const hourNow = new Date().getHours()
  const calPct = Math.min(100, Math.round((totals.calories / calorieTarget) * 100))
  const calColor = calBarColor(totals.calories, calorieTarget, hourNow)
  const proteinGap = Math.max(0, proteinTarget - Math.round(totals.protein_g))
  const carbTarget = Math.round(calorieTarget * 0.4 / 4)
  const fatTarget = Math.round(calorieTarget * 0.3 / 9)

  const grouped = MEAL_TYPES.map(type => ({ type, items: logs.filter(l => l.meal_type === type) }))
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

      {/* Yesterday strip */}
      {isToday && <YesterdayStrip proteinTarget={proteinTarget} todayStr={todayStr} />}

      {/* Daily Totals */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <UtensilsCrossed size={13} className="text-orange-400" />
          <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">{dateLabel}</span>
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
            <span className="text-xs font-semibold" style={{ color: calPct >= 90 ? '#22C55E' : 'rgba(255,255,255,0.3)' }}>
              {totals.calories > 0 ? `${calPct}%` : '0%'}
            </span>
          </div>
          <div className="w-full bg-muted/50 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${calPct}%`, backgroundColor: calColor }}
            />
          </div>
        </div>

        {/* Macro progress bars */}
        <div className="space-y-2.5">
          {[
            { label: 'Protein', value: Math.round(totals.protein_g), target: proteinTarget, color: '#F97316' },
            { label: 'Carbs', value: Math.round(totals.carbs_g), target: carbTarget, color: '#3B82F6' },
            { label: 'Fat', value: Math.round(totals.fats_g), target: fatTarget, color: '#EAB308' },
          ].map(({ label, value, target, color }) => {
            const pct = Math.min(100, Math.round((value / target) * 100))
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-muted-foreground/70 font-medium">{label}</span>
                  <span className="text-[11px]" style={{ color }}>
                    {value}g <span className="text-muted-foreground/40 text-[10px]">/ {target}g</span>
                  </span>
                </div>
                <div className="w-full bg-white/[0.06] rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Protein gap callout */}
        {proteinGap > 0 && (
          <p className="text-[11px] text-amber-400/80 mt-3 font-medium">{proteinGap}g protein to go</p>
        )}

        {/* Water tracker */}
        {isToday && <WaterTracker todayStr={todayStr} />}
      </div>

      {/* AI Tip card */}
      {isToday && <FoodTipCard proteinGap={proteinGap} onLogFood={handleLogFoodFromTip} />}

      {/* Add food form */}
      {showForm && (
        <div ref={formRef} className="bg-card border border-border rounded-2xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold shrink-0">Add Food</p>
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

              {/* Quick-add favourites */}
              {showFavourites && (
                <div className="space-y-2">
                  <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold px-1">Favourites</p>
                  <div className="space-y-1">
                    {QUICK_FAVOURITES.map((fav, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-white/[0.03] rounded-xl border border-white/[0.05]">
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-sm text-foreground/90 truncate">{fav.name}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">{fav.protein_g}g P · ~{fav.calories} kcal</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setForm(prev => ({
                              ...prev,
                              meal_type: fav.meal_type,
                              name: fav.name,
                              calories: String(fav.calories),
                              protein_g: String(fav.protein_g),
                              carbs_g: String(fav.carbs_g),
                              fats_g: String(fav.fats_g),
                            }))
                            setShowFavourites(false)
                          }}
                          className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/15 transition-colors shrink-0"
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-white/[0.04]" />
                    <span className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">or search / enter below</span>
                    <div className="h-px flex-1 bg-white/[0.04]" />
                  </div>
                </div>
              )}

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
                      autoFocus={!showFavourites}
                    />
                    {searching && (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 animate-spin" />
                    )}
                  </div>

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
                    <button type="button" onClick={clearSelection} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors shrink-0 mt-0.5">
                      <X size={14} />
                    </button>
                  </div>
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
            const groupProtein = Math.round(items.reduce((s, l) => s + (l.protein_g ?? 0), 0))
            const { dot } = MEAL_COLORS[type]

            // Per-meal protein target heuristic
            const perMealTarget = proteinTarget / 4
            const mealNeedsProtein = groupProtein < perMealTarget
            const firstSuggestionItemId = mealNeedsProtein ? items.find(l => l.meal_suggestions)?.id : undefined

            // Earliest log time for the meal
            const earliestItem = items.length > 0
              ? items.reduce((e, l) => l.created_at < e.created_at ? l : e)
              : null
            const timeLabel = (type === 'dinner' || type === 'snack')
              ? MEAL_TIME_HINTS[type]
              : earliestItem
              ? `Logged ${formatLogTime(earliestItem.created_at)}`
              : MEAL_TIME_HINTS[type]

            // Kitchen cut-off warning
            const kitchenCutoffMs = new Date().setHours(20, 30, 0, 0)
            const minsToClose = Math.max(0, Math.round((kitchenCutoffMs - Date.now()) / 60000))
            const showKitchenWarn = isToday && type === 'dinner' && items.length === 0 && hourNow >= 20 && !kitchenWarnDismissed

            // Dinner/snack suggestion
            const suggestions = type === 'dinner' ? DINNER_SUGGESTIONS : SNACK_SUGGESTIONS
            const suggestion = suggestions[Math.abs(proteinGap) % suggestions.length] ?? suggestions[0]

            return (
              <div key={type}>
                {/* Section header */}
                <div className="mb-2 px-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                      <p className="text-[13px] font-medium text-foreground/80 truncate">
                        {MEAL_LABELS[type]}
                        {groupCals > 0 && (
                          <span className="text-muted-foreground/50 text-[12px] font-normal ml-1.5">· {groupCals} kcal</span>
                        )}
                        <span className={cn(
                          'text-[11px] font-normal ml-1.5',
                          groupProtein === 0 ? 'text-red-400/60' : 'text-muted-foreground/40',
                        )}>
                          ({groupProtein}g P)
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => openFormForMeal(type)}
                      className="w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.10] transition-all shrink-0 ml-2"
                      title={`Add to ${MEAL_LABELS[type]}`}
                    >
                      <Plus size={11} strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground/35 ml-5 mt-0.5">{timeLabel}</p>
                </div>

                {/* Kitchen cut-off warning */}
                {showKitchenWarn && (
                  <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-2">
                    <p className="text-[11px] text-amber-400">
                      Kitchen cut-off in {minsToClose} min — log dinner to hit your target
                    </p>
                    <button
                      onClick={() => setKitchenWarnDismissed(true)}
                      className="text-amber-400/50 hover:text-amber-400 transition-colors ml-2 shrink-0"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}

                {items.length === 0 ? (
                  (type === 'dinner' || type === 'snack') ? (
                    <div>
                      <div className="bg-card/60 border border-white/[0.06] rounded-2xl px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-semibold mb-0.5">Suggested</p>
                            <p className="text-sm text-foreground/80 truncate">
                              {suggestion.name}
                              <span className="text-muted-foreground/40 text-xs ml-1.5">· {suggestion.hint}</span>
                            </p>
                          </div>
                          <button
                            onClick={() => openFormForMeal(type, suggestion.name)}
                            className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors font-medium whitespace-nowrap flex items-center gap-0.5 shrink-0"
                          >
                            Log this <ChevronRight size={11} />
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => openFormForMeal(type)}
                        className="w-full mt-1.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors py-1 text-center"
                      >
                        + Add something else
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openFormForMeal(type)}
                      className="w-full bg-card/60 border border-dashed border-white/[0.06] rounded-2xl px-4 py-3 flex items-center gap-2 text-muted-foreground/40 hover:text-muted-foreground hover:border-white/[0.10] transition-all"
                    >
                      <Plus size={13} strokeWidth={2} />
                      <span className="text-xs">Add {MEAL_LABELS[type].toLowerCase()}</span>
                    </button>
                  )
                ) : (
                  <div className="space-y-2">
                    {items.map(item => (
                      <div key={item.id} className="bg-card border border-border rounded-2xl">
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
                          <div className="px-4 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {/* Item name + protein badge */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                                  {item.protein_g !== null && item.protein_g > 0 && (
                                    <span
                                      className="text-[11px] px-1.5 py-0.5 rounded font-medium shrink-0"
                                      style={{ background: 'rgba(249,115,22,0.15)', color: '#F97316', borderRadius: 4 }}
                                    >
                                      {Math.round(item.protein_g)}g P
                                    </span>
                                  )}
                                </div>
                                {/* Macros */}
                                <p className="text-muted-foreground/60 text-xs mt-0.5">
                                  {[
                                    item.calories !== null && `${item.calories} kcal`,
                                    item.protein_g !== null && `${item.protein_g}g P`,
                                    item.carbs_g !== null && `${item.carbs_g}g C`,
                                    item.fats_g !== null && `${item.fats_g}g F`,
                                  ].filter(Boolean).join(' · ') || 'No macros logged'}
                                </p>
                                {/* AI suggestion — one per meal, only if meal is below target */}
                                {mealNeedsProtein && item.id === firstSuggestionItemId && item.meal_suggestions && (
                                  <p className="text-[12px] mt-1.5 flex items-center gap-1 leading-snug" style={{ color: 'rgba(34,197,94,0.8)' }}>
                                    <Sparkles size={10} className="shrink-0" style={{ color: '#22C55E' }} />
                                    {item.meal_suggestions}
                                  </p>
                                )}
                              </div>

                              {/* Overflow menu */}
                              <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => setOpenOverflowId(openOverflowId === item.id ? null : item.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground/70 hover:bg-white/[0.06] transition-all"
                                >
                                  <MoreHorizontal size={14} />
                                </button>
                                {openOverflowId === item.id && (
                                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1 z-10 min-w-[110px]">
                                    <button
                                      onClick={() => startEdit(item)}
                                      className="w-full text-left px-3 py-1.5 text-xs text-foreground/80 hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
                                    >
                                      <Pencil size={11} /> Edit
                                    </button>
                                    <button
                                      onClick={() => duplicate(item)}
                                      className="w-full text-left px-3 py-1.5 text-xs text-foreground/80 hover:bg-white/[0.06] flex items-center gap-2 transition-colors"
                                    >
                                      <Copy size={11} /> Duplicate
                                    </button>
                                    <button
                                      onClick={() => remove(item.id)}
                                      disabled={deletingId === item.id}
                                      className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/[0.08] flex items-center gap-2 transition-colors disabled:opacity-40"
                                    >
                                      <Trash2 size={11} /> Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
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
                  {(mealPlan.already_logged_calories ?? 0) > 0 && (
                    <div className="text-xs text-muted-foreground pb-1">
                      Already eaten: <span className="text-foreground/80 font-medium">{mealPlan.already_logged_calories} kcal · {mealPlan.already_logged_protein_g}g protein</span>
                    </div>
                  )}
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

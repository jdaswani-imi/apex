'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { X, Search, ChevronLeft } from 'lucide-react'

interface Exercise {
  id: string
  name: string
  category: string | null
  equipment: string | null
  primary_muscles: string[]
  force: string | null
  level: string | null
  display_gif: string | null
}

interface Props {
  onSelect: (name: string) => void
  onClose: () => void
  gender?: string
}

type Tab = 'muscle' | 'equipment' | 'az'

// ─── Muscle group definitions ─────────────────────────────────────────────────

const MUSCLE_GROUPS = [
  { key: 'chest',      label: 'Chest',      muscles: ['chest'],                                      emoji: '🫀' },
  { key: 'shoulders',  label: 'Shoulders',  muscles: ['shoulders'],                                  emoji: '💪' },
  { key: 'back',       label: 'Back',       muscles: ['lats', 'middle back', 'lower back', 'traps'], emoji: '🔙' },
  { key: 'biceps',     label: 'Biceps',     muscles: ['biceps'],                                     emoji: '💪' },
  { key: 'triceps',    label: 'Triceps',    muscles: ['triceps'],                                    emoji: '💪' },
  { key: 'legs',       label: 'Legs',       muscles: ['quadriceps', 'hamstrings', 'glutes', 'adductors', 'abductors'], emoji: '🦵' },
  { key: 'core',       label: 'Core',       muscles: ['abdominals'],                                 emoji: '⚡' },
  { key: 'calves',     label: 'Calves',     muscles: ['calves'],                                     emoji: '🦵' },
  { key: 'forearms',   label: 'Forearms',   muscles: ['forearms'],                                   emoji: '💪' },
  { key: 'neck',       label: 'Neck',       muscles: ['neck'],                                       emoji: '🔝' },
]

const EQUIPMENT_LABELS: Record<string, string> = {
  'barbell':       'Barbell',
  'dumbbell':      'Dumbbell',
  'cable':         'Cable',
  'machine':       'Machine',
  'body only':     'Bodyweight',
  'kettlebells':   'Kettlebell',
  'bands':         'Resistance Bands',
  'medicine ball': 'Medicine Ball',
  'exercise ball': 'Swiss Ball',
  'foam roll':     'Foam Roll',
  'e-z curl bar':  'EZ Curl Bar',
  'other':         'Other',
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExercisePicker({ onSelect, onClose, gender = 'male' }: Props) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('muscle')
  const [query, setQuery] = useState('')
  const [drillKey, setDrillKey] = useState<string | null>(null)
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/training/exercises?all=1&gender=${gender}`)
      .then(r => r.json())
      .then(data => {
        setExercises(data)
        setLoading(false)
        // Trigger one-time background sync if no media cached yet
        const hasMedia = data.some((e: Exercise) => e.display_gif)
        if (!hasMedia && !sessionStorage.getItem('exercisedb_sync_attempted')) {
          sessionStorage.setItem('exercisedb_sync_attempted', '1')
          fetch('/api/training/exercisedb/sync', { method: 'POST' }).catch(() => {})
        }
      })
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [gender])

  // ─── Derived lists ──────────────────────────────────────────────────────────

  const searchResults = useMemo(() => {
    if (query.length < 1) return []
    const q = query.toLowerCase()
    return exercises.filter(e => e.name.toLowerCase().includes(q))
  }, [query, exercises])

  const drillExercises = useMemo(() => {
    if (!drillKey) return []
    if (tab === 'muscle') {
      const group = MUSCLE_GROUPS.find(g => g.key === drillKey)
      if (!group) return []
      return exercises.filter(e =>
        e.primary_muscles.some(m => group.muscles.includes(m))
      )
    }
    if (tab === 'equipment') {
      return exercises.filter(e => (e.equipment ?? 'other') === drillKey)
    }
    return []
  }, [drillKey, tab, exercises])

  const letterExercises = useMemo(() => {
    if (tab !== 'az') return []
    if (selectedLetter) return exercises.filter(e => e.name.toUpperCase().startsWith(selectedLetter))
    return exercises
  }, [tab, selectedLetter, exercises])

  const muscleGroupCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const g of MUSCLE_GROUPS) {
      counts[g.key] = exercises.filter(e =>
        e.primary_muscles.some(m => g.muscles.includes(m))
      ).length
    }
    return counts
  }, [exercises])

  const equipmentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of exercises) {
      const k = e.equipment ?? 'other'
      counts[k] = (counts[k] ?? 0) + 1
    }
    return counts
  }, [exercises])

  const equipmentKeys = useMemo(() =>
    Object.keys(EQUIPMENT_LABELS).filter(k => (equipmentCounts[k] ?? 0) > 0)
  , [equipmentCounts])

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function handleSelect(name: string) {
    onSelect(name)
    onClose()
  }

  function handleTabChange(t: Tab) {
    setTab(t)
    setDrillKey(null)
    setSelectedLetter(null)
    setQuery('')
    listRef.current?.scrollTo(0, 0)
  }

  function drillIn(key: string) {
    setDrillKey(key)
    listRef.current?.scrollTo(0, 0)
  }

  function drillBack() {
    setDrillKey(null)
    listRef.current?.scrollTo(0, 0)
  }

  // ─── Render helpers ─────────────────────────────────────────────────────────

  function ExerciseRow({ ex }: { ex: Exercise }) {
    return (
      <button
        onClick={() => handleSelect(ex.name)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          width: '100%', padding: '10px 16px',
          background: 'none', border: 'none', borderBottom: '1px solid #111',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: '52px', height: '52px', borderRadius: '10px',
          flexShrink: 0, overflow: 'hidden',
          backgroundColor: '#1a1a1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {ex.display_gif ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ex.display_gif}
              alt={ex.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
          ) : (
            <span style={{ fontSize: '20px' }}>
              {MUSCLE_GROUPS.find(g => g.muscles.includes(ex.primary_muscles[0] ?? ''))?.emoji ?? '💪'}
            </span>
          )}
        </div>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{ex.name}</div>
          <div style={{ fontSize: '11px', color: '#52525b', marginTop: '2px' }}>
            {[
              ex.primary_muscles[0],
              ex.equipment ? (EQUIPMENT_LABELS[ex.equipment] ?? ex.equipment) : null,
              ex.level,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      </button>
    )
  }

  // ─── Sections ───────────────────────────────────────────────────────────────

  function renderMuscleGrid() {
    return (
      <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {MUSCLE_GROUPS.map(g => (
          <button
            key={g.key}
            onClick={() => drillIn(g.key)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '16px', backgroundColor: '#111', border: '1px solid #1c1c1c',
              borderRadius: '16px', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: '20px', marginBottom: '6px' }}>{g.emoji}</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{g.label}</span>
            <span style={{ fontSize: '11px', color: '#52525b', marginTop: '2px' }}>
              {muscleGroupCounts[g.key] ?? 0} exercises
            </span>
          </button>
        ))}
      </div>
    )
  }

  function renderEquipmentList() {
    return (
      <div style={{ padding: '8px 0' }}>
        {equipmentKeys.map(k => (
          <button
            key={k}
            onClick={() => drillIn(k)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '14px 20px',
              background: 'none', border: 'none', borderBottom: '1px solid #111',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              {EQUIPMENT_LABELS[k] ?? k}
            </span>
            <span style={{ fontSize: '12px', color: '#52525b' }}>
              {equipmentCounts[k]} →
            </span>
          </button>
        ))}
      </div>
    )
  }

  function renderAZ() {
    // Group by first letter
    const grouped: Record<string, Exercise[]> = {}
    for (const ex of letterExercises) {
      const l = ex.name[0].toUpperCase()
      if (!grouped[l]) grouped[l] = []
      grouped[l].push(ex)
    }
    const letters = Object.keys(grouped).sort()

    return (
      <div style={{ display: 'flex' }}>
        {/* Exercise list */}
        <div style={{ flex: 1 }}>
          {letters.map(l => (
            <div key={l}>
              <div style={{
                padding: '8px 20px 4px',
                fontSize: '11px', fontWeight: 700, color: '#52525b',
                letterSpacing: '0.06em', backgroundColor: '#0a0a0a',
                position: 'sticky', top: 0,
              }}>
                {l}
              </div>
              {grouped[l].map(ex => <ExerciseRow key={ex.id} ex={ex} />)}
            </div>
          ))}
        </div>
        {/* Letter index scrubber */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '8px 6px', gap: '1px', flexShrink: 0,
        }}>
          <button
            onClick={() => { setSelectedLetter(null); listRef.current?.scrollTo(0, 0) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '10px', padding: '2px 4px',
              color: selectedLetter === null ? '#f97316' : '#52525b',
              fontWeight: selectedLetter === null ? 700 : 400,
            }}
          >
            ALL
          </button>
          {ALPHABET.map(l => (
            <button
              key={l}
              onClick={() => { setSelectedLetter(l); listRef.current?.scrollTo(0, 0) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '11px', padding: '2px 4px', fontWeight: 600,
                color: selectedLetter === l ? '#f97316' : (grouped[l] ? '#71717a' : '#2a2a2a'),
              }}
              disabled={!grouped[l]}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  const isDrilled = !!drillKey
  const isSearching = query.length > 0

  let drillLabel = ''
  if (isDrilled && tab === 'muscle') {
    drillLabel = MUSCLE_GROUPS.find(g => g.key === drillKey)?.label ?? ''
  } else if (isDrilled && tab === 'equipment') {
    drillLabel = EQUIPMENT_LABELS[drillKey!] ?? drillKey!
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px',
          backgroundColor: '#0d0d0d', borderRadius: '24px 24px 0 0',
          border: '1px solid #1c1c1c', borderBottom: 'none',
          height: '88vh', display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 12px', flexShrink: 0,
        }}>
          {isDrilled ? (
            <button
              onClick={drillBack}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#f97316', fontSize: '14px', fontWeight: 600, padding: 0,
              }}
            >
              <ChevronLeft size={18} />
              {drillLabel}
            </button>
          ) : (
            <span style={{ fontSize: '17px', fontWeight: 700, color: '#fff' }}>
              Add Exercise
            </span>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
            <X size={20} color="#52525b" />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            backgroundColor: '#111', borderRadius: '12px',
            border: '1px solid #1c1c1c', padding: '10px 14px',
          }}>
            <Search size={15} color="#52525b" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search 873 exercises..."
              value={query}
              onChange={e => { setQuery(e.target.value); setDrillKey(null) }}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: '14px', color: '#fff', fontFamily: 'inherit',
              }}
            />
            {query && (
              <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <X size={14} color="#52525b" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs (hidden when searching or drilled in) */}
        {!isSearching && !isDrilled && (
          <div style={{
            display: 'flex', gap: '8px', padding: '0 16px 12px', flexShrink: 0,
          }}>
            {([
              { key: 'muscle',    label: 'Muscle' },
              { key: 'equipment', label: 'Equipment' },
              { key: 'az',        label: 'A–Z' },
            ] as { key: Tab; label: string }[]).map(t => (
              <button
                key={t.key}
                onClick={() => handleTabChange(t.key)}
                style={{
                  padding: '7px 16px', borderRadius: '20px',
                  border: tab === t.key ? 'none' : '1px solid #222',
                  backgroundColor: tab === t.key ? '#f97316' : 'transparent',
                  color: tab === t.key ? '#fff' : '#71717a',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '40px', textAlign: 'center', color: '#52525b', fontSize: '14px' }}>
              Loading exercises...
            </div>
          )}

          {!loading && isSearching && (
            <>
              {searchResults.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#52525b', fontSize: '14px' }}>
                  No exercises found
                </div>
              ) : (
                searchResults.map(ex => <ExerciseRow key={ex.id} ex={ex} />)
              )}
            </>
          )}

          {!loading && !isSearching && !isDrilled && tab === 'muscle' && renderMuscleGrid()}
          {!loading && !isSearching && !isDrilled && tab === 'equipment' && renderEquipmentList()}
          {!loading && !isSearching && !isDrilled && tab === 'az' && renderAZ()}

          {!loading && isDrilled && (
            <>
              {drillExercises.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#52525b', fontSize: '14px' }}>
                  No exercises found
                </div>
              ) : (
                drillExercises.map(ex => <ExerciseRow key={ex.id} ex={ex} />)
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

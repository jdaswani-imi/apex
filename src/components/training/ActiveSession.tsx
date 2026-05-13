'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Plus, Check, X, Trophy, ChevronDown, ChevronUp, Timer, GripVertical, Trash2 } from 'lucide-react'
import ExercisePicker from './ExercisePicker'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SetRow {
  localId: string
  savedId?: string
  set_type: 'warmup' | 'working'
  set_number: number
  weight_kg: number
  reps: number
  done: boolean
  is_pr: boolean
}

interface ExerciseLog {
  templateExerciseId?: string
  name: string
  sectionName: string
  sets: SetRow[]
  expanded: boolean
  notes: string
  restSeconds: number
  lastPerf?: { set_number: number; set_type: string; weight_kg: number; reps: number }[]
  gifUrl?: string | null
}

interface Section {
  name: string
  exercises: ExerciseLog[]
}

interface Props {
  sessionId: string
  templateId: string
  templateName: string
  templateColor: string
  gender?: string
  onFinish: () => void
}

let localIdCounter = 0
function newLocalId() { return `local-${++localIdCounter}` }

// ─── Component ────────────────────────────────────────────────────────────────

export default function ActiveSession({ sessionId, templateId, templateName, templateColor, gender = 'male', onFinish }: Props) {
  const [sections, setSections] = useState<Section[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [volume, setVolume] = useState(0)
  const [prs, setPrs] = useState(0)
  const [restTimer, setRestTimer] = useState<number | null>(null)
  const [restActive, setRestActive] = useState(false)
  const [restTotal, setRestTotal] = useState(120)
  const [finishing, setFinishing] = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [dragFrom, setDragFrom] = useState<{ secIdx: number; exIdx: number } | null>(null)
  const [dragOver, setDragOver] = useState<{ secIdx: number; exIdx: number } | null>(null)
  const dragFromRef = useRef<{ secIdx: number; exIdx: number } | null>(null)
  const dragOverRef = useRef<{ secIdx: number; exIdx: number } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const restRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    loadTemplate()
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => { clearInterval(timerRef.current); clearInterval(restRef.current) }
  }, [])

  useEffect(() => {
    let v = 0, p = 0
    sections.forEach(sec => sec.exercises.forEach(ex =>
      ex.sets.forEach(s => {
        if (s.done && s.set_type === 'working') {
          v += (s.weight_kg || 0) * (s.reps || 0)
          if (s.is_pr) p++
        }
      })
    ))
    setVolume(v)
    setPrs(p)
  }, [sections])

  async function loadTemplate() {
    const res = await fetch(`/api/training/templates/${templateId}`)
    const data = await res.json()

    const built: Section[] = (data.sections ?? []).map((sec: any) => ({
      name: sec.name,
      exercises: sec.exercises.map((ex: any) => {
        const lastPerf: any[] = data.last_performance?.[ex.exercise_name] ?? []

        const sets: SetRow[] = ex.sets.length > 0
          ? ex.sets.map((s: any, idx: number) => {
              const matching = lastPerf.find(
                lp => lp.set_type === s.set_type && lp.set_number === s.set_number
              )
              return {
                localId: newLocalId(),
                set_type: s.set_type,
                set_number: s.set_number,
                weight_kg: matching?.weight_kg ?? s.default_weight_kg ?? 0,
                reps: matching?.reps ?? s.default_reps ?? 0,
                done: false,
                is_pr: false,
              }
            })
          : [] // Treadmill / Stairmaster have no sets

        const media = data.exercise_media?.[ex.exercise_name]
        const gifUrl = media
          ? (gender === 'female' ? media.gif_url_female ?? media.gif_url : media.gif_url) ?? null
          : null

        return {
          templateExerciseId: ex.id,
          name: ex.exercise_name,
          sectionName: sec.name,
          sets,
          expanded: true,
          notes: ex.notes ?? '',
          restSeconds: ex.rest_seconds ?? 120,
          lastPerf,
          gifUrl,
        }
      }),
    }))

    setSections(built)
    setLoaded(true)
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  function startRestTimer(duration: number) {
    setRestTotal(duration)
    setRestTimer(duration)
    setRestActive(true)
    clearInterval(restRef.current)
    restRef.current = setInterval(() => {
      setRestTimer(t => {
        if (t === null || t <= 1) {
          clearInterval(restRef.current)
          setRestActive(false)
          return null
        }
        return t - 1
      })
    }, 1000)
  }

  function stopRestTimer() {
    clearInterval(restRef.current)
    setRestActive(false)
    setRestTimer(null)
  }

  function updateSections(updater: (draft: Section[]) => Section[]) {
    setSections(prev => updater(structuredClone(prev)))
  }

  async function tickSet(secIdx: number, exIdx: number, setIdx: number) {
    const ex = sections[secIdx].exercises[exIdx]
    const set = ex.sets[setIdx]
    const newDone = !set.done

    if (newDone) {
      // Check PR against last performance
      const lastWorking = (ex.lastPerf ?? []).filter(lp => lp.set_type === 'working')
      const maxLastWeight = Math.max(0, ...lastWorking.map(lp => lp.weight_kg ?? 0))
      const maxLastReps = Math.max(0, ...lastWorking.filter(lp => lp.weight_kg === maxLastWeight).map(lp => lp.reps ?? 0))
      const isPr = set.set_type === 'working' && (
        set.weight_kg > maxLastWeight ||
        (set.weight_kg === maxLastWeight && set.reps > maxLastReps)
      )

      const res = await fetch('/api/training/exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          name: ex.name,
          set_number: set.set_number,
          set_type: set.set_type,
          section_name: ex.sectionName,
          template_exercise_id: ex.templateExerciseId ?? null,
          sets: 1,
          reps: set.reps,
          weight_kg: set.weight_kg,
          is_pr: isPr,
          is_completed: true,
          notes: ex.notes || null,
        }),
      })
      const saved = await res.json()

      updateSections(draft => {
        draft[secIdx].exercises[exIdx].sets[setIdx] = {
          ...set, done: true, is_pr: isPr, savedId: saved.id,
        }
        return draft
      })

      if (set.set_type === 'working' && ex.restSeconds > 0) {
        startRestTimer(ex.restSeconds)
      }
    } else {
      updateSections(draft => {
        draft[secIdx].exercises[exIdx].sets[setIdx] = {
          ...set, done: false, is_pr: false,
        }
        return draft
      })
    }
  }

  function updateSetField(secIdx: number, exIdx: number, setIdx: number, field: 'weight_kg' | 'reps', value: number) {
    updateSections(draft => {
      draft[secIdx].exercises[exIdx].sets[setIdx] = {
        ...draft[secIdx].exercises[exIdx].sets[setIdx],
        [field]: value,
      }
      return draft
    })
  }

  function addSet(secIdx: number, exIdx: number) {
    updateSections(draft => {
      const ex = draft[secIdx].exercises[exIdx]
      const lastWorking = [...ex.sets].reverse().find(s => s.set_type === 'working') ?? ex.sets[ex.sets.length - 1]
      const nextNum = ex.sets.filter(s => s.set_type === 'working').length + 1
      ex.sets.push({
        localId: newLocalId(),
        set_type: 'working',
        set_number: nextNum,
        weight_kg: lastWorking?.weight_kg ?? 0,
        reps: lastWorking?.reps ?? 0,
        done: false,
        is_pr: false,
      })
      return draft
    })
  }

  function addWarmupSet(secIdx: number, exIdx: number) {
    updateSections(draft => {
      const ex = draft[secIdx].exercises[exIdx]
      const warmups = ex.sets.filter(s => s.set_type === 'warmup')
      const nextNum = warmups.length + 1
      const insertIdx = ex.sets.findLastIndex(s => s.set_type === 'warmup') + 1
      const warmupWeight = Math.round((ex.sets.find(s => s.set_type === 'working')?.weight_kg ?? 40) * 0.5)
      ex.sets.splice(insertIdx, 0, {
        localId: newLocalId(),
        set_type: 'warmup',
        set_number: nextNum,
        weight_kg: warmupWeight,
        reps: 15,
        done: false,
        is_pr: false,
      })
      return draft
    })
  }

  function removeSet(secIdx: number, exIdx: number, setIdx: number) {
    updateSections(draft => {
      const ex = draft[secIdx].exercises[exIdx]
      if (ex.sets.length <= 1) return draft
      ex.sets.splice(setIdx, 1)
      // Re-number working sets
      let wNum = 0
      ex.sets = ex.sets.map(s => s.set_type === 'working' ? { ...s, set_number: ++wNum } : s)
      return draft
    })
  }

  function toggleExpanded(secIdx: number, exIdx: number) {
    updateSections(draft => {
      draft[secIdx].exercises[exIdx].expanded = !draft[secIdx].exercises[exIdx].expanded
      return draft
    })
  }

  function updateNotes(secIdx: number, exIdx: number, notes: string) {
    updateSections(draft => {
      draft[secIdx].exercises[exIdx].notes = notes
      return draft
    })
  }

  function addExercise(name: string) {
    updateSections(draft => {
      if (draft.length === 0) draft.push({ name: 'Other', exercises: [] })
      const lastSec = draft[draft.length - 1]
      lastSec.exercises.push({
        name,
        sectionName: lastSec.name,
        sets: [{
          localId: newLocalId(),
          set_type: 'working',
          set_number: 1,
          weight_kg: 0, reps: 0, done: false, is_pr: false,
        }],
        expanded: true,
        notes: '',
        restSeconds: 90,
      })
      return draft
    })
  }

  function removeExercise(secIdx: number, exIdx: number) {
    updateSections(draft => {
      draft[secIdx].exercises.splice(exIdx, 1)
      return draft
    })
  }

  function onDragHandlePointerDown(secIdx: number, exIdx: number, e: React.PointerEvent<Element>) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragFromRef.current = { secIdx, exIdx }
    dragOverRef.current = { secIdx, exIdx }
    setDragFrom({ secIdx, exIdx })
    setDragOver({ secIdx, exIdx })

    function onMove(ev: PointerEvent) {
      const els = document.elementsFromPoint(ev.clientX, ev.clientY)
      for (const el of els) {
        const card = (el as HTMLElement).closest?.('[data-ex-card]') as HTMLElement | null
        if (card) {
          const s = parseInt(card.dataset.secIdx!)
          const ex = parseInt(card.dataset.exIdx!)
          if (!isNaN(s) && !isNaN(ex) && s === dragFromRef.current?.secIdx) {
            dragOverRef.current = { secIdx: s, exIdx: ex }
            setDragOver({ secIdx: s, exIdx: ex })
          }
          break
        }
      }
    }

    function onUp() {
      const from = dragFromRef.current
      const over = dragOverRef.current
      if (from && over && from.exIdx !== over.exIdx) {
        updateSections(draft => {
          const exs = draft[from.secIdx].exercises
          const [moved] = exs.splice(from.exIdx, 1)
          exs.splice(over.exIdx, 0, moved)
          return draft
        })
      }
      dragFromRef.current = null
      dragOverRef.current = null
      setDragFrom(null)
      setDragOver(null)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  async function discardSession() {
    setDiscarding(true)
    await fetch(`/api/training/session/${sessionId}`, { method: 'DELETE' })
    onFinish()
  }

  async function finishSession() {
    setFinishing(true)
    await fetch(`/api/training/session/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        duration_min: Math.round(elapsed / 60),
        volume_kg: Math.round(volume),
        prs,
        finished_at: new Date().toISOString(),
      }),
    })
    onFinish()
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#1c1c1c', border: '1px solid #27272a',
    borderRadius: '8px', padding: '8px 10px',
    fontSize: '15px', color: '#fff', outline: 'none',
    textAlign: 'center', width: '64px', fontFamily: 'inherit',
  }

  const restProgress = restTimer !== null && restTotal > 0
    ? 1 - restTimer / restTotal
    : 0

  // Flatten all exercises for set-done count in header
  const allExercises = sections.flatMap(s => s.exercises)
  const totalSets = allExercises.flatMap(e => e.sets).filter(s => s.set_type === 'working').length
  const doneSets = allExercises.flatMap(e => e.sets).filter(s => s.done && s.set_type === 'working').length

  return (
    <div style={{ backgroundColor: '#000', minHeight: '100vh' }}>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        backgroundColor: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #111', padding: '48px 20px 12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: templateColor }} />
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{templateName}</div>
            </div>
            <div style={{ fontSize: '13px', color: '#52525b', marginTop: '2px' }}>
              {formatTime(elapsed)} · {doneSets}/{totalSets} sets
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{Math.round(volume).toLocaleString()}</div>
              <div style={{ fontSize: '10px', color: '#52525b' }}>kg</div>
            </div>
            {prs > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '18px', fontWeight: 700, color: '#f59e0b' }}>{prs}</div>
                <div style={{ fontSize: '10px', color: '#52525b' }}>PRs</div>
              </div>
            )}
          </div>
        </div>

        {/* Rest timer bar */}
        {restActive && restTimer !== null && (
          <div style={{ marginTop: '10px' }}>
            <div style={{
              height: '3px', backgroundColor: '#1c1c1c', borderRadius: '2px', overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                backgroundColor: templateColor,
                width: `${restProgress * 100}%`,
                transition: 'width 1s linear',
              }} />
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginTop: '6px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Timer size={12} color="#7c3aed" />
                <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 600 }}>
                  Rest: {formatTime(restTimer)}
                </span>
              </div>
              <button
                onClick={stopRestTimer}
                style={{ background: 'none', border: 'none', color: '#52525b', cursor: 'pointer', fontSize: '12px' }}
              >
                Skip
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {!loaded && (
          <div style={{ color: '#52525b', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>
            Loading template...
          </div>
        )}

        {sections.map((section, secIdx) => (
          <div key={secIdx}>
            {/* Section heading */}
            <div style={{
              fontSize: '11px', fontWeight: 700, color: '#3f3f46',
              letterSpacing: '0.08em', padding: '16px 4px 8px',
              textTransform: 'uppercase',
            }}>
              {section.name}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {section.exercises.map((ex, exIdx) => {
                const isDragging = dragFrom?.secIdx === secIdx && dragFrom?.exIdx === exIdx
                const isDragTarget = !isDragging && dragOver?.secIdx === secIdx && dragOver?.exIdx === exIdx && !!dragFrom
                return (
                  <div
                    key={`${secIdx}-${exIdx}-${ex.name}`}
                    data-ex-card=""
                    data-sec-idx={String(secIdx)}
                    data-ex-idx={String(exIdx)}
                    style={{
                      opacity: isDragging ? 0.35 : 1,
                      transition: 'opacity 0.1s',
                      borderTop: isDragTarget ? '2px solid #f97316' : '2px solid transparent',
                      borderRadius: '2px',
                    }}
                  >
                    <ExerciseCard
                      ex={ex}
                      templateColor={templateColor}
                      inputStyle={inputStyle}
                      gifUrl={ex.gifUrl}
                      onToggle={() => toggleExpanded(secIdx, exIdx)}
                      onTickSet={(setIdx) => tickSet(secIdx, exIdx, setIdx)}
                      onUpdateSet={(setIdx, field, val) => updateSetField(secIdx, exIdx, setIdx, field, val)}
                      onAddSet={() => addSet(secIdx, exIdx)}
                      onAddWarmup={() => addWarmupSet(secIdx, exIdx)}
                      onRemoveSet={(setIdx) => removeSet(secIdx, exIdx, setIdx)}
                      onUpdateNotes={(n) => updateNotes(secIdx, exIdx, n)}
                      onNameChange={(name) => updateSections(draft => {
                        draft[secIdx].exercises[exIdx].name = name
                        return draft
                      })}
                      onRemoveExercise={() => removeExercise(secIdx, exIdx)}
                      onDragHandlePointerDown={e => onDragHandlePointerDown(secIdx, exIdx, e)}
                    />
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Add exercise */}
        {loaded && (
          <button
            onClick={() => setShowPicker(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
              width: '100%', backgroundColor: '#111', border: '1px dashed #27272a',
              borderRadius: '16px', padding: '14px', cursor: 'pointer',
              fontSize: '14px', color: '#52525b', marginTop: '8px',
            }}
          >
            <Plus size={16} /> Add exercise
          </button>
        )}

        {/* Finish + Discard row */}
        {loaded && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            {/* Discard */}
            <button
              onClick={() => setShowDiscardConfirm(true)}
              disabled={finishing || discarding}
              style={{
                flexShrink: 0, backgroundColor: '#111',
                color: '#ef4444', fontWeight: 600, padding: '18px 20px',
                borderRadius: '18px', border: '1px solid #27272a',
                cursor: 'pointer', fontSize: '15px',
                opacity: finishing || discarding ? 0.5 : 1,
              }}
            >
              Discard
            </button>

            {/* Save */}
            <button
              onClick={doneSets > 0 ? finishSession : undefined}
              disabled={finishing || discarding || doneSets === 0}
              title={doneSets === 0 ? 'Complete at least one set to save' : undefined}
              style={{
                flex: 1, backgroundColor: doneSets === 0 ? '#1c1c1c' : templateColor,
                color: doneSets === 0 ? '#52525b' : '#fff',
                fontWeight: 700, padding: '18px', borderRadius: '18px',
                border: 'none', fontSize: '16px',
                cursor: doneSets === 0 ? 'not-allowed' : 'pointer',
                opacity: finishing ? 0.7 : 1,
                filter: doneSets > 0 ? 'brightness(0.9)' : 'none',
                transition: 'background-color 0.2s, color 0.2s',
              }}
            >
              {finishing ? 'Saving...' : doneSets === 0 ? 'No sets done' : `Save · ${Math.round(volume).toLocaleString()}kg`}
            </button>
          </div>
        )}
      </div>

      {/* Exercise picker */}
      {showPicker && (
        <ExercisePicker
          onSelect={name => addExercise(name)}
          onClose={() => setShowPicker(false)}
          gender={gender}
        />
      )}

      {/* Discard confirmation modal */}
      {showDiscardConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px',
        }}>
          <div style={{
            width: '100%', maxWidth: '480px',
            backgroundColor: '#111', borderRadius: '24px',
            border: '1px solid #1c1c1c', padding: '28px 24px',
          }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
              Discard workout?
            </div>
            <div style={{ fontSize: '14px', color: '#71717a', marginBottom: '24px', lineHeight: '1.5' }}>
              {doneSets > 0
                ? `You've completed ${doneSets} set${doneSets === 1 ? '' : 's'}. This data will be permanently deleted.`
                : 'This workout will be deleted and nothing will be saved.'}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowDiscardConfirm(false)}
                style={{
                  flex: 1, backgroundColor: '#1c1c1c', color: '#fff',
                  fontWeight: 600, padding: '16px', borderRadius: '14px',
                  border: '1px solid #27272a', cursor: 'pointer', fontSize: '15px',
                }}
              >
                Keep going
              </button>
              <button
                onClick={() => { setShowDiscardConfirm(false); discardSession() }}
                disabled={discarding}
                style={{
                  flex: 1, backgroundColor: '#ef4444', color: '#fff',
                  fontWeight: 700, padding: '16px', borderRadius: '14px',
                  border: 'none', cursor: 'pointer', fontSize: '15px',
                  opacity: discarding ? 0.7 : 1,
                }}
              >
                {discarding ? 'Discarding...' : 'Yes, discard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Exercise Card ─────────────────────────────────────────────────────────────

interface ExerciseSuggestion {
  id: string
  name: string
  category: string | null
  equipment: string | null
  primary_muscles: string[]
  force: string | null
}

function ExerciseNameInput({ value, onChange, inputStyle }: {
  value: string
  onChange: (name: string) => void
  inputStyle: React.CSSProperties
}) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<ExerciseSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback((q: string) => {
    clearTimeout(debounceRef.current)
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/training/exercises?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSuggestions(data)
      setOpen(data.length > 0)
    }, 200)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    onChange(v)
    search(v)
  }

  function select(s: ExerciseSuggestion) {
    setQuery(s.name)
    onChange(s.name)
    setSuggestions([])
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder="Exercise name"
        value={query}
        onChange={handleChange}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        onClick={e => e.stopPropagation()}
        style={{ ...inputStyle, width: '180px', textAlign: 'left', padding: '6px 10px' }}
        autoComplete="off"
      />
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a',
            borderRadius: '12px', marginTop: '4px', minWidth: '240px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)', overflow: 'hidden',
          }}
        >
          {suggestions.map(s => (
            <button
              key={s.id}
              onMouseDown={e => { e.preventDefault(); select(s) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '10px 14px', borderBottom: '1px solid #222',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{s.name}</div>
              <div style={{ fontSize: '11px', color: '#52525b', marginTop: '2px' }}>
                {[s.primary_muscles?.[0], s.equipment].filter(Boolean).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Swipe-to-delete row ──────────────────────────────────────────────────────

function SwipeRow({ children, onDelete, disabled }: {
  children: React.ReactNode
  onDelete: () => void
  disabled?: boolean
}) {
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startX = useRef(0)

  function onTouchStart(e: React.TouchEvent) {
    if (disabled) return
    startX.current = e.touches[0].clientX
    setSwiping(true)
  }

  function onTouchMove(e: React.TouchEvent) {
    if (!swiping) return
    const delta = e.touches[0].clientX - startX.current
    if (delta < 0) setOffset(Math.max(delta, -80))
    else if (offset < 0) setOffset(0)
  }

  function onTouchEnd() {
    setSwiping(false)
    if (offset <= -60) {
      onDelete()
      setOffset(0)
    } else {
      setOffset(0)
    }
  }

  return (
    <div style={{ position: 'relative', overflow: 'hidden', marginBottom: '8px' }}>
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0, width: '80px',
        backgroundColor: '#ef4444', borderRadius: '8px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: Math.min(1, Math.abs(offset) / 60),
      }}>
        <Trash2 size={16} color="#fff" />
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  )
}

// ─── Exercise card ────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  ex: ExerciseLog
  templateColor: string
  inputStyle: React.CSSProperties
  onToggle: () => void
  onTickSet: (setIdx: number) => void
  onUpdateSet: (setIdx: number, field: 'weight_kg' | 'reps', val: number) => void
  onAddSet: () => void
  onAddWarmup: () => void
  onRemoveSet: (setIdx: number) => void
  onUpdateNotes: (n: string) => void
  onNameChange: (name: string) => void
  onRemoveExercise: () => void
  onDragHandlePointerDown: (e: React.PointerEvent<Element>) => void
  gifUrl?: string | null
}

function ExerciseCard({
  ex, templateColor, inputStyle,
  onToggle, onTickSet, onUpdateSet, onAddSet, onAddWarmup,
  onRemoveSet, onUpdateNotes, onNameChange,
  onRemoveExercise, onDragHandlePointerDown,
  gifUrl,
}: ExerciseCardProps) {
  const workingSets = ex.sets.filter(s => s.set_type === 'working')
  const doneSets = workingSets.filter(s => s.done).length
  const hasPr = ex.sets.some(s => s.is_pr)
  const isDurationOnly = ex.sets.length === 0

  // Last performance summary string
  const lastPerf = ex.lastPerf?.filter(lp => lp.set_type === 'working')
  const lastPerfStr = lastPerf && lastPerf.length > 0
    ? lastPerf.slice(0, 3).map(lp => `${lp.weight_kg}×${lp.reps}`).join(' ')
    : null

  return (
    <div style={{
      backgroundColor: '#111', border: '1px solid #1c1c1c',
      borderRadius: '18px', overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', cursor: 'pointer', gap: '8px',
        }}
        onClick={onToggle}
      >
        {/* Drag handle */}
        <div
          onPointerDown={onDragHandlePointerDown}
          onClick={e => e.stopPropagation()}
          style={{ color: '#2a2a2a', cursor: 'grab', touchAction: 'none', flexShrink: 0, padding: '2px' }}
        >
          <GripVertical size={16} />
        </div>

        {/* Exercise GIF thumbnail */}
        {gifUrl && (
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            overflow: 'hidden', flexShrink: 0, backgroundColor: '#1a1a1a',
          }}>
            <img
              src={gifUrl}
              alt={ex.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              loading="lazy"
            />
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          {ex.name && !ex.expanded ? (
            <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ex.name}</div>
          ) : (
            <ExerciseNameInput
              value={ex.name}
              onChange={onNameChange}
              inputStyle={inputStyle}
            />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
            {!isDurationOnly && (
              <span style={{ fontSize: '12px', color: '#52525b' }}>
                {doneSets}/{workingSets.length} sets
              </span>
            )}
            {lastPerfStr && (
              <span style={{ fontSize: '11px', color: '#3f3f46' }}>Last: {lastPerfStr}</span>
            )}
            {hasPr && <span style={{ fontSize: '11px', color: '#f59e0b' }}>🏆 PR</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          {ex.expanded && (
            <button
              onClick={e => { e.stopPropagation(); onRemoveExercise() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#3f3f46' }}
            >
              <Trash2 size={15} color="#ef4444" />
            </button>
          )}
          {ex.expanded ? <ChevronUp size={16} color="#52525b" /> : <ChevronDown size={16} color="#52525b" />}
        </div>
      </div>

      {/* Sets */}
      {ex.expanded && (
        <div style={{ padding: '0 16px 14px' }}>
          {isDurationOnly ? (
            <div style={{ fontSize: '13px', color: '#52525b', fontStyle: 'italic', marginBottom: '8px' }}>
              {ex.notes || 'Duration-based exercise'}
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', paddingLeft: '4px' }}>
                <span style={{ fontSize: '10px', color: '#3f3f46', width: '28px' }}>SET</span>
                <span style={{ fontSize: '10px', color: '#3f3f46', width: '64px', textAlign: 'center' }}>KG</span>
                <span style={{ fontSize: '10px', color: '#3f3f46', width: '64px', textAlign: 'center' }}>REPS</span>
              </div>

              {ex.sets.map((set, setIdx) => {
                const isWarmup = set.set_type === 'warmup'
                const canDelete = !set.done && ex.sets.length > 1
                return (
                  <SwipeRow
                    key={set.localId}
                    onDelete={() => onRemoveSet(setIdx)}
                    disabled={!canDelete}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '12px',
                        color: isWarmup ? '#52525b' : '#71717a',
                        width: '28px', flexShrink: 0,
                        fontWeight: isWarmup ? 500 : 400,
                      }}>
                        {isWarmup ? 'W' : set.set_number}
                      </span>

                      <input
                        type="number"
                        value={set.weight_kg || ''}
                        onChange={e => onUpdateSet(setIdx, 'weight_kg', parseFloat(e.target.value) || 0)}
                        style={{
                          ...inputStyle,
                          opacity: set.done ? 0.5 : 1,
                          backgroundColor: set.done ? '#0a0a0a' : isWarmup ? '#161616' : '#1c1c1c',
                          borderColor: isWarmup ? '#222' : '#27272a',
                        }}
                        disabled={set.done}
                      />

                      <input
                        type="number"
                        value={set.reps || ''}
                        onChange={e => onUpdateSet(setIdx, 'reps', parseInt(e.target.value) || 0)}
                        style={{
                          ...inputStyle,
                          opacity: set.done ? 0.5 : 1,
                          backgroundColor: set.done ? '#0a0a0a' : isWarmup ? '#161616' : '#1c1c1c',
                          borderColor: isWarmup ? '#222' : '#27272a',
                        }}
                        disabled={set.done}
                      />

                      <button
                        onClick={() => onTickSet(setIdx)}
                        style={{
                          width: '36px', height: '36px', borderRadius: '50%', border: 'none',
                          backgroundColor: set.done
                            ? (set.is_pr ? '#f59e0b' : (isWarmup ? '#27272a' : '#22c55e'))
                            : '#1c1c1c',
                          cursor: 'pointer', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: isWarmup && set.done ? 0.7 : 1,
                        }}
                      >
                        {set.is_pr
                          ? <Trophy size={14} color="#000" />
                          : <Check size={14} color={set.done ? (isWarmup ? '#71717a' : '#000') : '#3f3f46'} />
                        }
                      </button>
                    </div>
                  </SwipeRow>
                )
              })}

              {/* Add set / warm-up row */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                <button
                  onClick={onAddSet}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#52525b', fontSize: '13px', padding: '2px 0',
                  }}
                >
                  <Plus size={13} /> Add set
                </button>
                <button
                  onClick={onAddWarmup}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#3f3f46', fontSize: '13px', padding: '2px 0',
                  }}
                >
                  <Plus size={13} /> Warm-up
                </button>
              </div>
            </>
          )}

          {/* Notes */}
          {!isDurationOnly && (
            <input
              type="text"
              placeholder="Notes (optional)"
              value={ex.notes}
              onChange={e => onUpdateNotes(e.target.value)}
              style={{
                marginTop: '10px', width: '100%', boxSizing: 'border-box',
                backgroundColor: '#1c1c1c', border: '1px solid #1a1a1a',
                borderRadius: '8px', padding: '8px 12px',
                fontSize: '13px', color: '#71717a', outline: 'none', fontFamily: 'inherit',
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

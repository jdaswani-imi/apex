'use client'

import { useState, useEffect } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'

// Core compound lifts users are most likely to have prior numbers for
const COMPOUND_LIFTS = [
  { name: 'Barbell Back Squat', group: 'Legs', defaultReps: 5 },
  { name: 'Barbell Bench Press', group: 'Push', defaultReps: 5 },
  { name: 'Barbell Deadlift', group: 'Pull', defaultReps: 5 },
  { name: 'Barbell Overhead Press', group: 'Push', defaultReps: 5 },
  { name: 'Barbell Row', group: 'Pull', defaultReps: 8 },
  { name: 'Romanian Deadlift', group: 'Legs', defaultReps: 8 },
  { name: 'Incline Barbell Press', group: 'Push', defaultReps: 8 },
  { name: 'Pull-Up', group: 'Pull', defaultReps: 8 },
  { name: 'Leg Press', group: 'Legs', defaultReps: 10 },
  { name: 'Dumbbell Shoulder Press', group: 'Push', defaultReps: 10 },
  { name: 'Dumbbell Curl', group: 'Pull', defaultReps: 10 },
  { name: 'Tricep Dip', group: 'Push', defaultReps: 10 },
]

interface LiftEntry {
  exercise_name: string
  current_weight_kg: number
  current_reps: number
  selected: boolean
}

interface Props {
  onClose: () => void
  onSaved: () => void
}

export default function BaselineSetup({ onClose, onSaved }: Props) {
  const [entries, setEntries] = useState<LiftEntry[]>(
    COMPOUND_LIFTS.map(l => ({
      exercise_name: l.name,
      current_weight_kg: 0,
      current_reps: l.defaultReps,
      selected: false,
    }))
  )
  const [saving, setSaving] = useState(false)
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set())

  // Pre-mark lifts that already have baselines
  useEffect(() => {
    fetch('/api/training/baselines')
      .then(r => r.json())
      .then((data: Array<{ exercise_name: string; current_weight_kg: number; current_reps: number }>) => {
        const names = new Set(data.map(d => d.exercise_name))
        setExistingNames(names)
        setEntries(prev => prev.map(e => {
          const existing = data.find(d => d.exercise_name === e.exercise_name)
          if (existing) {
            return {
              ...e,
              current_weight_kg: existing.current_weight_kg ?? 0,
              current_reps: existing.current_reps ?? e.current_reps,
              selected: true,
            }
          }
          return e
        }))
      })
      .catch(() => { /* ignore */ })
  }, [])

  function toggleSelect(idx: number) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, selected: !e.selected } : e))
  }

  function updateWeight(idx: number, val: number) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, current_weight_kg: val } : e))
  }

  function updateReps(idx: number, val: number) {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, current_reps: val } : e))
  }

  async function handleSave() {
    const selected = entries.filter(e => e.selected && e.current_weight_kg > 0)
    if (selected.length === 0) { onClose(); return }
    setSaving(true)
    try {
      await fetch('/api/training/baselines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selected.map(e => ({
          exercise_name: e.exercise_name,
          current_weight_kg: e.current_weight_kg,
          current_reps: e.current_reps,
        }))),
      })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = entries.filter(e => e.selected && e.current_weight_kg > 0).length
  const groups = ['Push', 'Pull', 'Legs'] as const

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        padding: '52px 20px 16px',
        borderBottom: '1px solid #111',
        backgroundColor: 'rgba(0,0,0,0.96)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Your Starting Numbers</div>
            <div style={{ fontSize: '13px', color: '#52525b', lineHeight: '1.5', maxWidth: '280px' }}>
              Tell the AI what you can lift so it can build smarter workouts from day one.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#52525b', flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {groups.map(group => {
          const lifts = COMPOUND_LIFTS.filter(l => l.group === group)
          return (
            <div key={group} style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, color: '#3f3f46',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                marginBottom: '10px',
              }}>
                {group}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {lifts.map(lift => {
                  const idx = entries.findIndex(e => e.exercise_name === lift.name)
                  const entry = entries[idx]
                  const isExisting = existingNames.has(lift.name)

                  return (
                    <div
                      key={lift.name}
                      style={{
                        backgroundColor: entry.selected ? '#0f1f0f' : '#111',
                        border: `1px solid ${entry.selected ? 'rgba(34,197,94,0.25)' : '#1c1c1c'}`,
                        borderRadius: '14px',
                        overflow: 'hidden',
                        transition: 'background-color 0.2s, border-color 0.2s',
                      }}
                    >
                      {/* Lift row */}
                      <button
                        onClick={() => toggleSelect(idx)}
                        style={{
                          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                          padding: '12px 14px',
                          display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                          backgroundColor: entry.selected ? '#22c55e' : '#1c1c1c',
                          border: `1px solid ${entry.selected ? '#22c55e' : '#27272a'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background-color 0.2s, border-color 0.2s',
                        }}>
                          {entry.selected && <Check size={13} color="#000" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>{lift.name}</div>
                          {isExisting && (
                            <div style={{ fontSize: '10px', color: '#3f3f46', marginTop: '2px' }}>Already saved</div>
                          )}
                        </div>
                        {!entry.selected && <ChevronRight size={14} color="#3f3f46" />}
                      </button>

                      {/* Expandable weight/reps inputs */}
                      {entry.selected && (
                        <div style={{
                          padding: '0 14px 14px',
                          display: 'flex', gap: '12px', alignItems: 'center',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', color: '#3f3f46', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>WEIGHT (KG)</div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <button
                                onClick={() => updateWeight(idx, Math.max(0, entry.current_weight_kg - 2.5))}
                                style={{ width: '36px', height: '44px', borderRadius: '8px 0 0 8px', backgroundColor: '#1a1a1a', border: '1px solid #27272a', borderRight: 'none', color: '#71717a', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              >−</button>
                              <input
                                type="number"
                                value={entry.current_weight_kg || ''}
                                onChange={e => updateWeight(idx, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                style={{ flex: 1, height: '44px', backgroundColor: '#1c1c1c', border: '1px solid #27272a', borderLeft: 'none', borderRight: 'none', fontSize: '16px', color: '#fff', outline: 'none', textAlign: 'center', fontFamily: 'inherit', fontVariantNumeric: 'tabular-nums', minWidth: 0 }}
                              />
                              <button
                                onClick={() => updateWeight(idx, entry.current_weight_kg + 2.5)}
                                style={{ width: '36px', height: '44px', borderRadius: '0 8px 8px 0', backgroundColor: '#1a1a1a', border: '1px solid #27272a', borderLeft: 'none', color: '#71717a', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              >+</button>
                            </div>
                          </div>

                          <div style={{ width: '90px' }}>
                            <div style={{ fontSize: '10px', color: '#3f3f46', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.05em' }}>REPS</div>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              <button
                                onClick={() => updateReps(idx, Math.max(1, entry.current_reps - 1))}
                                style={{ width: '30px', height: '44px', borderRadius: '8px 0 0 8px', backgroundColor: '#1a1a1a', border: '1px solid #27272a', borderRight: 'none', color: '#71717a', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              >−</button>
                              <div style={{ width: '30px', height: '44px', backgroundColor: '#1c1c1c', border: '1px solid #27272a', borderLeft: 'none', borderRight: 'none', fontSize: '15px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>
                                {entry.current_reps}
                              </div>
                              <button
                                onClick={() => updateReps(idx, entry.current_reps + 1)}
                                style={{ width: '30px', height: '44px', borderRadius: '0 8px 8px 0', backgroundColor: '#1a1a1a', border: '1px solid #27272a', borderLeft: 'none', color: '#71717a', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                              >+</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        <div style={{ fontSize: '12px', color: '#3f3f46', textAlign: 'center', padding: '8px 0 16px', lineHeight: '1.6' }}>
          These numbers seed the AI — it will refine them automatically as you log more sessions.
        </div>
      </div>

      {/* Save button */}
      <div style={{
        flexShrink: 0,
        padding: '16px 20px',
        borderTop: '1px solid #111',
        backgroundColor: 'rgba(0,0,0,0.96)',
      }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            backgroundColor: selectedCount > 0 ? '#c8a876' : '#1c1c1c',
            color: selectedCount > 0 ? '#0d0c0b' : '#52525b',
            fontWeight: 700, fontSize: '16px',
            padding: '18px', borderRadius: '18px', border: 'none',
            cursor: selectedCount > 0 ? 'pointer' : 'default',
            transition: 'background-color 0.2s, color 0.2s',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving...' : selectedCount > 0 ? `Save ${selectedCount} lift${selectedCount === 1 ? '' : 's'}` : 'Select lifts to save'}
        </button>
      </div>
    </div>
  )
}

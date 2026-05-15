'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Plus, Trash2, UserCircle } from 'lucide-react'

import { getCyclePhase } from '@/lib/types'

type Section = 'profile' | 'goals' | 'training' | 'supplements' | 'lifestyle' | 'baselines' | 'cycle' | null

export default function SettingsPage() {
  const [section, setSection] = useState<Section>(null)
  // Settings data shapes come from multiple Supabase tables without generated types;
  // using Record<string, unknown> provides type safety over bare `any`
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [goals, setGoals] = useState<Record<string, unknown> | null>(null)
  const [training, setTraining] = useState<Record<string, unknown> | null>(null)
  const [supplements, setSupplements] = useState<Record<string, unknown>[]>([])
  const [lifestyle, setLifestyle] = useState<Record<string, unknown> | null>(null)
  const [baselines, setBaselines] = useState<Record<string, unknown>[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [whoopConnected, setWhoopConnected] = useState(false)
  const [cycles, setCycles] = useState<Record<string, unknown>[]>([])
  const [newCycle, setNewCycle] = useState({ period_start_date: '', period_end_date: '', cycle_length_days: 28, notes: '' })

  useEffect(() => { loadAll(); loadCycles() }, [])

  useEffect(() => {
    fetch('/api/whoop/status').then(r => r.json()).then(d => setWhoopConnected(d.connected))
  }, [])

  async function loadAll() {
    const res = await fetch('/api/settings')
    const data = await res.json()
    setProfile(data.profile ?? {})
    setGoals(data.goals ?? {})
    setTraining(data.training ?? {})
    setSupplements(data.supplements ?? [])
    setLifestyle(data.lifestyle ?? {})
    setBaselines(data.baselines ?? [])
  }

  async function loadCycles() {
    const res = await fetch('/api/cycle')
    const data = await res.json()
    setCycles(data ?? [])
  }

  async function logCycle() {
    if (!newCycle.period_start_date) return
    setSaving(true)
    await fetch('/api/cycle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCycle),
    })
    setSaving(false)
    setNewCycle({ period_start_date: '', period_end_date: '', cycle_length_days: 28, notes: '' })
    await loadCycles()
  }

  async function deleteCycle(id: string) {
    await fetch(`/api/cycle?id=${id}`, { method: 'DELETE' })
    await loadCycles()
  }

  async function save(table: string, payload: Record<string, unknown>) {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table, data: payload }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveSupplement(supp: Record<string, unknown>) {
    setSaving(true)
    await fetch('/api/settings/supplement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supp),
    })
    setSaving(false)
    await loadAll()
  }

  async function deleteSupplement(id: string) {
    await fetch(`/api/settings/supplement?id=${id}`, { method: 'DELETE' })
    await loadAll()
  }

  async function saveBaseline(b: Record<string, unknown>) {
    setSaving(true)
    await fetch('/api/settings/baseline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(b),
    })
    setSaving(false)
    await loadAll()
  }

  const menuItems = [
    { key: 'profile', label: 'Profile', desc: 'Name, age, height, location' },
    { key: 'goals', label: 'Goals & Targets', desc: 'Weight, protein, calories, event' },
    { key: 'training', label: 'Training Split', desc: 'Days, gym, cardio targets' },
    { key: 'supplements', label: 'Supplement Stack', desc: 'Your full supplement list' },
    { key: 'lifestyle', label: 'Lifestyle', desc: 'Sleep, coffee, diet preferences' },
    { key: 'baselines', label: 'Exercise Baselines', desc: 'Current PRs and targets' },
    { key: 'cycle', label: 'Cycle Tracking', desc: 'Period log & phase-aware coaching' },
  ]

  if (section === null) {
    return (
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8">
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Settings</h1>
        <p style={{ fontSize: '14px', color: '#52525b', marginBottom: '24px' }}>Everything the AI uses to coach you</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Complete Profile */}
          <a
            href="/onboarding"
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: '16px', padding: '16px 20px', marginBottom: '4px',
              textDecoration: 'none',
            }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              backgroundColor: 'rgba(249,115,22,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <UserCircle size={20} color="#f97316" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#f97316' }}>Complete your profile</div>
              <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>Full questionnaire — helps the AI coach know you</div>
            </div>
            <ChevronRight size={18} color="#f97316" />
          </a>

          {/* Whoop connection */}
          <div style={{
            backgroundColor: whoopConnected ? '#0a1f0a' : '#111',
            border: `1px solid ${whoopConnected ? '#14532d' : '#1c1c1c'}`,
            borderRadius: '16px', padding: '16px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '8px',
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: whoopConnected ? '#4ade80' : '#fff' }}>
                {whoopConnected ? '✓ Whoop Connected' : 'Connect Whoop'}
              </div>
              <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>
                {whoopConnected ? 'Recovery, sleep and strain syncing' : 'Sync recovery, sleep and strain'}
              </div>
            </div>
            {!whoopConnected && (
              <a
                href="/api/whoop/login"
                style={{
                  backgroundColor: '#fff', color: '#000',
                  fontWeight: 600, padding: '8px 16px',
                  borderRadius: '10px', fontSize: '13px',
                  textDecoration: 'none',
                }}
              >
                Connect
              </a>
            )}
            {whoopConnected && (
              <button
                onClick={async () => {
                  await fetch('/api/whoop/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days: 7 }) })
                  alert('Synced!')
                }}
                style={{
                  backgroundColor: '#14532d', color: '#4ade80',
                  fontWeight: 600, padding: '8px 16px',
                  borderRadius: '10px', fontSize: '13px',
                  border: 'none', cursor: 'pointer',
                }}
              >
                Sync now
              </button>
            )}
          </div>

          {menuItems.map(item => (
            <button
              key={item.key}
              onClick={() => setSection(item.key as Section)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                backgroundColor: '#111', border: '1px solid #1c1c1c',
                borderRadius: '16px', padding: '16px 20px',
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>{item.desc}</div>
              </div>
              <ChevronRight size={18} color="#3f3f46" />
            </button>
          ))}
        </div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: '#111', border: '1px solid #27272a',
    borderRadius: '10px', padding: '10px 14px', fontSize: '14px',
    color: '#fff', outline: 'none', fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '12px', color: '#71717a', fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', display: 'block',
  }

  const fieldStyle: React.CSSProperties = { marginBottom: '16px' }

  const saveBtn = (table: string, payload: Record<string, unknown>) => (
    <button
      onClick={() => save(table, payload)}
      disabled={saving}
      style={{
        width: '100%', backgroundColor: '#fff', color: '#000',
        fontWeight: 600, padding: '14px', borderRadius: '14px',
        border: 'none', cursor: 'pointer', fontSize: '15px', marginTop: '8px',
      }}
    >
      {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save changes'}
    </button>
  )

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8">
      <button
        onClick={() => setSection(null)}
        style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: '14px', cursor: 'pointer', marginBottom: '20px', padding: 0 }}
      >
        ← Back
      </button>

      {/* PROFILE */}
      {section === 'profile' && profile && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>Profile</h2>
          {[
            { key: 'name', label: 'Name', type: 'text' },
            { key: 'age', label: 'Age', type: 'number' },
            { key: 'height_cm', label: 'Height (cm)', type: 'number' },
            { key: 'location', label: 'Location', type: 'text' },
            { key: 'timezone', label: 'Timezone', type: 'text' },
          ].map(f => (
            <div key={f.key} style={fieldStyle}>
              <label style={labelStyle}>{f.label}</label>
              <input
                type={f.type}
                value={(profile[f.key] as string | number) ?? ''}
                onChange={e => setProfile({ ...profile, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}
          <div style={fieldStyle}>
            <label style={labelStyle}>Gender</label>
            <select
              value={(profile.gender as string) ?? 'male'}
              onChange={e => setProfile({ ...profile, gender: e.target.value })}
              style={{ ...inputStyle, appearance: 'none' as React.CSSProperties['appearance'] }}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          {saveBtn('user_profile', profile)}
        </div>
      )}

      {/* GOALS */}
      {section === 'goals' && goals && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>Goals & Targets</h2>
          {[
            { key: 'start_weight_kg', label: 'Start Weight (kg)', type: 'number' },
            { key: 'current_weight_kg', label: 'Current Weight (kg)', type: 'number' },
            { key: 'target_weight_kg', label: 'Target Weight (kg)', type: 'number' },
            { key: 'body_fat_pct', label: 'Body Fat % (estimated)', type: 'number' },
            { key: 'daily_protein_target_g', label: 'Daily Protein Target (g)', type: 'number' },
            { key: 'daily_calorie_target', label: 'Daily Calorie Target', type: 'number' },
            { key: 'daily_steps_target', label: 'Daily Steps Target', type: 'number' },
            { key: 'target_event_name', label: 'Target Event Name', type: 'text' },
            { key: 'target_event_date', label: 'Target Event Date', type: 'date' },
            { key: 'target_event_location', label: 'Target Event Location', type: 'text' },
          ].map(f => (
            <div key={f.key} style={fieldStyle}>
              <label style={labelStyle}>{f.label}</label>
              <input
                type={f.type}
                value={(goals[f.key] as string | number) ?? ''}
                onChange={e => setGoals({ ...goals, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}
          {saveBtn('user_goals', goals)}
        </div>
      )}

      {/* TRAINING */}
      {section === 'training' && training && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>Training Split</h2>
          {[
            { key: 'gym_name', label: 'Gym Name', type: 'text' },
            { key: 'smith_machine_bar_kg', label: 'Smith Machine Bar Weight (kg)', type: 'number' },
            { key: 'cardio_target_duration_min', label: 'Cardio Target Duration (min)', type: 'number' },
            { key: 'cardio_target_level', label: 'Stairmaster Target Level', type: 'number' },
          ].map(f => (
            <div key={f.key} style={fieldStyle}>
              <label style={labelStyle}>{f.label}</label>
              <input
                type={f.type}
                value={(training[f.key] as string | number) ?? ''}
                onChange={e => setTraining({ ...training, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Training Split by Day</label>
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#71717a', width: '80px', flexShrink: 0 }}>{day}</span>
                <input
                  type="text"
                  value={((training?.training_split as Record<string, string> | null)?.[String(i)]) ?? ''}
                  onChange={e => setTraining({
                    ...training,
                    training_split: { ...(training?.training_split as Record<string, string> | null), [String(i)]: e.target.value }
                  })}
                  style={{ ...inputStyle, marginBottom: 0 }}
                />
              </div>
            ))}
          </div>
          {saveBtn('user_training', training)}
        </div>
      )}

      {/* SUPPLEMENTS */}
      {section === 'supplements' && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>Supplement Stack</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {supplements.map((s, i) => (
              <div key={(s.id as string) ?? i} style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '14px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, marginRight: '10px' }}>
                    <input
                      type="text"
                      value={(s.name as string) ?? ''}
                      onChange={e => {
                        const updated = [...supplements]
                        updated[i] = { ...s, name: e.target.value }
                        setSupplements(updated)
                      }}
                      style={{ ...inputStyle, marginBottom: '8px', fontWeight: 600 }}
                      placeholder="Supplement name"
                    />
                    <input
                      type="text"
                      value={(s.dose as string) ?? ''}
                      onChange={e => {
                        const updated = [...supplements]
                        updated[i] = { ...s, dose: e.target.value }
                        setSupplements(updated)
                      }}
                      style={{ ...inputStyle, marginBottom: '8px' }}
                      placeholder="Dose"
                    />
                    <input
                      type="text"
                      value={(s.timing_notes as string) ?? ''}
                      onChange={e => {
                        const updated = [...supplements]
                        updated[i] = { ...s, timing_notes: e.target.value }
                        setSupplements(updated)
                      }}
                      style={inputStyle}
                      placeholder="Timing notes (e.g. 30 min before lunch)"
                    />
                  </div>
                  {s.id != null && (
                    <button
                      onClick={() => deleteSupplement(s.id as string)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => saveSupplement(s)}
                  style={{
                    marginTop: '10px', width: '100%', backgroundColor: '#1c1c1c',
                    border: 'none', borderRadius: '8px', padding: '8px',
                    fontSize: '12px', color: '#a1a1aa', cursor: 'pointer',
                  }}
                >
                  Save this supplement
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              const newSupp = {
                name: '', dose: '', timing: 'before_bed', timing_notes: '',
                sort_order: supplements.length + 1, active: true,
              }
              setSupplements([...supplements, newSupp])
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center',
              width: '100%', backgroundColor: '#111', border: '1px dashed #27272a',
              borderRadius: '14px', padding: '14px', cursor: 'pointer',
              fontSize: '14px', color: '#71717a',
            }}
          >
            <Plus size={16} /> Add supplement
          </button>
        </div>
      )}

      {/* LIFESTYLE */}
      {section === 'lifestyle' && lifestyle && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>Lifestyle</h2>
          {[
            { key: 'diet_type', label: 'Diet Type', type: 'text' },
            { key: 'wake_time_weekday', label: 'Wake Time (Weekday)', type: 'time' },
            { key: 'wake_time_weekend', label: 'Wake Time (Weekend)', type: 'time' },
            { key: 'sleep_target_weeknight', label: 'Sleep Target (Weeknight)', type: 'time' },
            { key: 'sleep_target_sunday', label: 'Sleep Target (Sunday)', type: 'time' },
            { key: 'coffee_cutoff', label: 'Coffee Cut-off', type: 'time' },
            { key: 'work_start_weekday', label: 'Work Start (Weekday)', type: 'time' },
            { key: 'work_end_weekday', label: 'Work End (Weekday)', type: 'time' },
            { key: 'social_night', label: 'Social Night (fri/sat)', type: 'text' },
          ].map(f => (
            <div key={f.key} style={fieldStyle}>
              <label style={labelStyle}>{f.label}</label>
              <input
                type={f.type}
                value={(lifestyle[f.key] as string) ?? ''}
                onChange={e => setLifestyle({ ...lifestyle, [f.key]: e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}
          {saveBtn('user_lifestyle', lifestyle)}
        </div>
      )}

      {/* CYCLE TRACKING */}
      {section === 'cycle' && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Cycle Tracking</h2>
          <p style={{ fontSize: '13px', color: '#52525b', marginBottom: '20px' }}>Log your period so Apex can factor your cycle phase into coaching.</p>

          {/* Current phase banner */}
          {cycles.length > 0 && (() => {
            const latest = cycles[0]
            const info = getCyclePhase(
              latest.period_start_date as string,
              /* cycle_length_days is a number stored in the DB row */ latest.cycle_length_days as number,
            )
            const phaseColors: Record<string, string> = {
              menstrual: '#ef4444', follicular: '#22c55e', ovulatory: '#f59e0b', luteal: '#8b5cf6',
            }
            const phaseLabels: Record<string, string> = {
              menstrual: 'Menstrual', follicular: 'Follicular', ovulatory: 'Ovulatory', luteal: 'Luteal',
            }
            const phaseNotes: Record<string, string> = {
              menstrual: 'Lower intensity, prioritise recovery. Iron-rich foods help.',
              follicular: 'Rising energy and strength. Good time to push harder.',
              ovulatory: 'Peak strength and confidence — best time for PRs.',
              luteal: 'Progesterone rising. Moderate intensity. Extra magnesium helps.',
            }
            const color = phaseColors[info.phase]
            return (
              <div style={{
                backgroundColor: `${color}10`, border: `1px solid ${color}30`,
                borderRadius: '16px', padding: '16px 20px', marginBottom: '20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {phaseLabels[info.phase]} phase
                  </span>
                  <span style={{ fontSize: '12px', color: '#71717a' }}>Day {info.cycleDay} of {info.cycleLength}</span>
                </div>
                <p style={{ fontSize: '13px', color: '#a1a1aa', margin: 0 }}>{phaseNotes[info.phase]}</p>
                <p style={{ fontSize: '11px', color: '#52525b', margin: '6px 0 0' }}>
                  ~{info.daysUntilNextPeriod} days until next period
                </p>
              </div>
            )
          })()}

          {/* Log new period */}
          <div style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7', marginBottom: '12px' }}>Log a period</div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Period start date</label>
              <input type="date" value={newCycle.period_start_date}
                onChange={e => setNewCycle({ ...newCycle, period_start_date: e.target.value })}
                style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Period end date (optional)</label>
              <input type="date" value={newCycle.period_end_date}
                onChange={e => setNewCycle({ ...newCycle, period_end_date: e.target.value })}
                style={inputStyle} />
            </div>
            <div style={fieldStyle}>
              <label style={labelStyle}>Average cycle length (days)</label>
              <input type="number" value={newCycle.cycle_length_days}
                onChange={e => setNewCycle({ ...newCycle, cycle_length_days: Number(e.target.value) })}
                style={inputStyle} min={21} max={40} />
            </div>
            <button
              onClick={logCycle}
              disabled={saving || !newCycle.period_start_date}
              style={{
                width: '100%', backgroundColor: newCycle.period_start_date ? '#fff' : '#27272a',
                color: newCycle.period_start_date ? '#000' : '#52525b',
                fontWeight: 600, padding: '12px', borderRadius: '12px',
                border: 'none', cursor: newCycle.period_start_date ? 'pointer' : 'default', fontSize: '14px',
              }}
            >
              {saving ? 'Saving...' : 'Log period'}
            </button>
          </div>

          {/* History */}
          {cycles.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>History</div>
              {cycles.map((c) => (
                <div key={c.id as string} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '12px',
                  padding: '12px 16px', marginBottom: '8px',
                }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#e4e4e7' }}>{c.period_start_date as string}</div>
                    {c.period_end_date != null && (
                      <div style={{ fontSize: '12px', color: '#71717a' }}>Ended {c.period_end_date as string}</div>
                    )}
                    <div style={{ fontSize: '12px', color: '#52525b' }}>{c.cycle_length_days as number}d cycle</div>
                  </div>
                  <button onClick={() => deleteCycle(c.id as string)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BASELINES */}
      {section === 'baselines' && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '20px' }}>Exercise Baselines</h2>
          {['push', 'pull', 'legs'].map(type => {
            const group = baselines.filter(b => b.session_type === type)
            if (group.length === 0) return null
            return (
              <div key={type} style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '12px', color: '#7c3aed', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                  {type}
                </div>
                {group.map((b) => (
                  <div key={b.id as string} style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '14px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7', marginBottom: '10px' }}>{b.exercise_name as string}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px' }}>
                      {[
                        { key: 'current_weight_kg', label: 'Weight' },
                        { key: 'current_reps', label: 'Reps' },
                        { key: 'target_weight_kg', label: 'Target W' },
                        { key: 'target_reps', label: 'Target R' },
                      ].map(f => (
                        <div key={f.key}>
                          <label style={{ ...labelStyle, fontSize: '10px' }}>{f.label}</label>
                          <input
                            type="number"
                            value={(b[f.key] as number) ?? ''}
                            onChange={e => {
                              const updated = baselines.map(x =>
                                x.id === b.id ? { ...x, [f.key]: Number(e.target.value) } : x
                              )
                              setBaselines(updated)
                            }}
                            style={{ ...inputStyle, padding: '8px 10px', fontSize: '13px' }}
                          />
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => saveBaseline(b)}
                      style={{
                        marginTop: '10px', width: '100%', backgroundColor: '#1c1c1c',
                        border: 'none', borderRadius: '8px', padding: '8px',
                        fontSize: '12px', color: '#a1a1aa', cursor: 'pointer',
                      }}
                    >
                      Save
                    </button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

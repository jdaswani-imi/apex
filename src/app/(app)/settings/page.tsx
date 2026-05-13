'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'

type Section = 'profile' | 'goals' | 'training' | 'supplements' | 'lifestyle' | 'baselines' | null

export default function SettingsPage() {
  const [section, setSection] = useState<Section>(null)
  const [profile, setProfile] = useState<any>(null)
  const [goals, setGoals] = useState<any>(null)
  const [training, setTraining] = useState<any>(null)
  const [supplements, setSupplements] = useState<any[]>([])
  const [lifestyle, setLifestyle] = useState<any>(null)
  const [baselines, setBaselines] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [whoopConnected, setWhoopConnected] = useState(false)

  useEffect(() => { loadAll() }, [])

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

  async function save(table: string, payload: any) {
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

  async function saveSupplement(supp: any) {
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

  async function saveBaseline(b: any) {
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
  ]

  if (section === null) {
    return (
      <div style={{ padding: '48px 20px 24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>Settings</h1>
        <p style={{ fontSize: '14px', color: '#52525b', marginBottom: '24px' }}>Everything the AI uses to coach you</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

  const saveBtn = (table: string, payload: any) => (
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
    <div style={{ padding: '48px 20px 24px' }}>
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
                value={profile[f.key] ?? ''}
                onChange={e => setProfile({ ...profile, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}
          <div style={fieldStyle}>
            <label style={labelStyle}>Gender</label>
            <select
              value={profile.gender ?? 'male'}
              onChange={e => setProfile({ ...profile, gender: e.target.value })}
              style={{ ...inputStyle, appearance: 'none' as any }}
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
                value={goals[f.key] ?? ''}
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
                value={training[f.key] ?? ''}
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
                  value={training?.training_split?.[String(i)] ?? ''}
                  onChange={e => setTraining({
                    ...training,
                    training_split: { ...training.training_split, [String(i)]: e.target.value }
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
              <div key={s.id ?? i} style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '14px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, marginRight: '10px' }}>
                    <input
                      type="text"
                      value={s.name}
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
                      value={s.dose ?? ''}
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
                      value={s.timing_notes ?? ''}
                      onChange={e => {
                        const updated = [...supplements]
                        updated[i] = { ...s, timing_notes: e.target.value }
                        setSupplements(updated)
                      }}
                      style={inputStyle}
                      placeholder="Timing notes (e.g. 30 min before lunch)"
                    />
                  </div>
                  {s.id && (
                    <button
                      onClick={() => deleteSupplement(s.id)}
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
                value={lifestyle[f.key] ?? ''}
                onChange={e => setLifestyle({ ...lifestyle, [f.key]: e.target.value })}
                style={inputStyle}
              />
            </div>
          ))}
          {saveBtn('user_lifestyle', lifestyle)}
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
                  <div key={b.id} style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '12px', padding: '14px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#e4e4e7', marginBottom: '10px' }}>{b.exercise_name}</div>
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
                            value={b[f.key] ?? ''}
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

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Check,
  User, Calendar, Dumbbell, UtensilsCrossed, Pill,
  Moon, Sparkles, Wind, Brain, Plane, Cpu, Target,
  Plus, Minus, Flame, X, Star,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepId =
  | 'welcome' | 'interests' | 'physical' | 'lifestyle' | 'training' | 'nutrition'
  | 'supplements' | 'sleep' | 'skincare' | 'hair' | 'mental'
  | 'travel' | 'tech' | 'coaching' | 'done'

interface StepMeta {
  id: StepId
  label: string
  icon: React.ElementType | null
  color: string
  section: string | null
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS: StepMeta[] = [
  { id: 'welcome',     label: 'Welcome',               icon: null,              color: '#f97316', section: null },
  { id: 'physical',   label: 'Physical Profile',       icon: User,              color: '#f97316', section: 'physical' },
  { id: 'interests',   label: 'Your Priorities',       icon: Star,              color: '#f97316', section: 'interests' },
  { id: 'lifestyle',  label: 'Lifestyle & Schedule',   icon: Calendar,          color: '#8b5cf6', section: 'lifestyle_ext' },
  { id: 'training',   label: 'Training & Gym',         icon: Dumbbell,          color: '#3b82f6', section: 'training_ext' },
  { id: 'nutrition',  label: 'Nutrition & Diet',       icon: UtensilsCrossed,   color: '#10b981', section: 'nutrition_ext' },
  { id: 'mental',     label: 'Mental & Stress',        icon: Brain,             color: '#f43f5e', section: 'mental' },
  { id: 'sleep',      label: 'Sleep & Recovery',       icon: Moon,              color: '#6366f1', section: 'sleep_ext' },
  { id: 'supplements',label: 'Supplements',            icon: Pill,              color: '#f59e0b', section: 'supplements_ext' },
  { id: 'skincare',   label: 'Skincare',               icon: Sparkles,          color: '#ec4899', section: 'skincare' },
  { id: 'hair',       label: 'Hair',                   icon: Wind,              color: '#14b8a6', section: 'hair' },
  { id: 'travel',     label: 'Travel & Social',        icon: Plane,             color: '#06b6d4', section: 'travel' },
  { id: 'tech',       label: 'Tech & Wearables',       icon: Cpu,               color: '#84cc16', section: 'tech_prefs' },
  { id: 'coaching',   label: 'Coaching Preferences',   icon: Target,            color: '#f97316', section: 'coaching' },
  { id: 'done',       label: 'All done!',              icon: null,              color: '#f97316', section: null },
]

const CONTENT_STEPS = STEPS.filter(s => s.id !== 'welcome' && s.id !== 'done')

const OPTIONAL_STEP_IDS = new Set<StepId>(['lifestyle', 'supplements', 'sleep', 'skincare', 'hair', 'mental', 'travel', 'tech'])

function getNextIndex(from: number, dir: 'forward' | 'back', focusedSections: string[]): number {
  const inc = dir === 'forward' ? 1 : -1
  let next = from + inc
  while (next > 0 && next < STEPS.length - 1) {
    const s = STEPS[next]
    if (!OPTIONAL_STEP_IDS.has(s.id) || focusedSections.includes(s.id)) return next
    next += inc
  }
  return Math.max(0, Math.min(next, STEPS.length - 1))
}

// ─── Country → City map ───────────────────────────────────────────────────────

const COUNTRY_CITIES: Record<string, string[]> = {
  UAE: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Other'],
  UK: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Edinburgh', 'Other'],
  USA: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'San Francisco', 'Other'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Other'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Dammam', 'Other'],
  Qatar: ['Doha', 'Other'],
  Kuwait: ['Kuwait City', 'Other'],
  Bahrain: ['Manama', 'Other'],
  India: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 'Kolkata', 'Other'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Other'],
}

function getCitiesForCountry(country: string): string[] {
  return COUNTRY_CITIES[country] ?? ['Capital / Main city', 'Other']
}

const COUNTRIES = [
  'Australia', 'Bahrain', 'Brazil', 'Canada', 'China', 'Egypt', 'France',
  'Germany', 'India', 'Indonesia', 'Ireland', 'Israel', 'Italy', 'Japan',
  'Jordan', 'Kenya', 'Kuwait', 'Malaysia', 'Mexico', 'Netherlands',
  'New Zealand', 'Nigeria', 'Oman', 'Pakistan', 'Philippines', 'Portugal',
  'Qatar', 'Saudi Arabia', 'Singapore', 'South Africa', 'South Korea',
  'Spain', 'Sweden', 'Thailand', 'Turkey', 'UAE', 'UK', 'USA', 'Other',
]

// ─── Reusable primitive components ────────────────────────────────────────────

function Chips({
  options, value, onChange, multi = false,
}: {
  options: string[]
  value: string | string[]
  onChange: (v: string | string[]) => void
  multi?: boolean
}) {
  function toggle(opt: string) {
    if (multi) {
      const arr = (value as string[]) ?? []
      onChange(arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt])
    } else {
      onChange(opt === value ? '' : opt)
    }
  }

  const isSelected = (opt: string) =>
    multi ? (value as string[])?.includes(opt) : value === opt

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => toggle(opt)}
          style={{
            padding: '8px 16px',
            borderRadius: '100px',
            border: isSelected(opt) ? '1.5px solid #f97316' : '1.5px solid #27272a',
            backgroundColor: isSelected(opt) ? 'rgba(249,115,22,0.12)' : '#111',
            color: isSelected(opt) ? '#f97316' : '#a1a1aa',
            fontSize: '13px',
            fontWeight: isSelected(opt) ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function Stepper({
  value, onChange, min = 0, max = 999, step = 1, suffix = '',
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        style={{
          width: '44px', height: '44px', borderRadius: '12px',
          backgroundColor: '#1c1c1c', border: '1px solid #27272a',
          color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Minus size={16} />
      </button>
      <span style={{ fontSize: '28px', fontWeight: 700, color: '#fff', minWidth: '80px', textAlign: 'center' }}>
        {value}{suffix}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        style={{
          width: '44px', height: '44px', borderRadius: '12px',
          backgroundColor: '#1c1c1c', border: '1px solid #27272a',
          color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Plus size={16} />
      </button>
    </div>
  )
}

function RangeSlider({
  value, onChange, min = 1, max = 10, label,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', color: '#71717a' }}>{min}</span>
        <span style={{ fontSize: '22px', fontWeight: 700, color: '#f97316' }}>{value}{label ? ` ${label}` : ''}</span>
        <span style={{ fontSize: '13px', color: '#71717a' }}>{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: '6px', borderRadius: '3px', appearance: 'none',
          background: `linear-gradient(to right, #f97316 ${pct}%, #27272a ${pct}%)`,
          outline: 'none', cursor: 'pointer',
        }}
      />
    </div>
  )
}

function Toggle({
  value, onChange, labelOn = 'Yes', labelOff = 'No',
}: {
  value: boolean
  onChange: (v: boolean) => void
  labelOn?: string
  labelOff?: string
}) {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {[true, false].map(opt => (
        <button
          key={String(opt)}
          onClick={() => onChange(opt)}
          style={{
            padding: '10px 28px',
            borderRadius: '100px',
            border: value === opt ? '1.5px solid #f97316' : '1.5px solid #27272a',
            backgroundColor: value === opt ? 'rgba(249,115,22,0.12)' : '#111',
            color: value === opt ? '#f97316' : '#a1a1aa',
            fontSize: '14px',
            fontWeight: value === opt ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {opt ? labelOn : labelOff}
        </button>
      ))}
    </div>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ fontSize: '15px', fontWeight: 600, color: '#e4e4e7', marginBottom: hint ? '4px' : '12px' }}>
        {label}
      </div>
      {hint && (
        <div style={{ fontSize: '12px', color: '#52525b', marginBottom: '12px' }}>{hint}</div>
      )}
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', backgroundColor: '#111', border: '1px solid #27272a',
  borderRadius: '12px', padding: '12px 16px', fontSize: '14px',
  color: '#fff', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2371717a' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 16px center',
  paddingRight: '40px',
}

// ─── Body fat silhouette visualiser ──────────────────────────────────────────

function BodyFatVisual({ sex, value }: { sex: string; value: number }) {
  const isFemale = sex === 'Female'
  const levels = isFemale
    ? [15, 20, 25, 30, 35]
    : [10, 15, 20, 25, 30]

  function closest(arr: number[], val: number) {
    return arr.reduce((a, b) => Math.abs(b - val) < Math.abs(a - val) ? b : a)
  }
  const highlighted = closest(levels, value)

  function SilhouetteSVG({ pct, female, active }: { pct: number; female: boolean; active: boolean }) {
    // scale belly girth 0..1 based on index in the range
    const minPct = female ? 15 : 10
    const maxPct = female ? 35 : 30
    const t = (pct - minPct) / (maxPct - minPct) // 0..1
    const bodyW = 16 + t * 14        // 16..30
    const waistW = 12 + t * 16       // 12..28
    const hipW = female ? bodyW + 4 + t * 8 : bodyW + 2 + t * 4
    const headR = 9
    const stroke = active ? '#f97316' : '#3f3f46'
    const fill = active ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)'

    return (
      <svg width="48" height="90" viewBox="0 0 48 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* head */}
        <circle cx="24" cy={headR + 2} r={headR} fill={fill} stroke={stroke} strokeWidth="1.5" />
        {/* neck */}
        <rect x="21" y={headR + 2 + headR - 2} width="6" height="5" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
        {/* torso — shoulder to waist */}
        <path
          d={`
            M ${24 - bodyW / 2} 28
            Q ${24 - bodyW / 2 - 4} 32, ${24 - waistW / 2} 50
            L ${24 + waistW / 2} 50
            Q ${24 + bodyW / 2 + 4} 32, ${24 + bodyW / 2} 28
            Z
          `}
          fill={fill} stroke={stroke} strokeWidth="1.5"
        />
        {/* hips */}
        <path
          d={`
            M ${24 - waistW / 2} 50
            Q ${24 - hipW / 2} 58, ${24 - hipW / 2 + 2} 68
            L ${24 + hipW / 2 - 2} 68
            Q ${24 + hipW / 2} 58, ${24 + waistW / 2} 50
            Z
          `}
          fill={fill} stroke={stroke} strokeWidth="1.5"
        />
        {/* legs */}
        <rect x={24 - hipW / 2 + 2} y="66" width={hipW / 2 - 3} height="20" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
        <rect x="24" y="66" width={hipW / 2 - 3} height="20" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
      </svg>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'space-between', marginTop: '12px' }}>
      {levels.map(pct => (
        <div key={pct} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <SilhouetteSVG pct={pct} female={isFemale} active={pct === highlighted} />
          <span style={{ fontSize: '11px', color: pct === highlighted ? '#f97316' : '#52525b', fontWeight: pct === highlighted ? 700 : 400 }}>
            {pct}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Evening commitment repeater ──────────────────────────────────────────────

const ACTIVITY_OPTIONS = [
  'Weight Training', 'Cardio', 'Yoga', 'Pilates', 'Swimming', 'Cycling',
  'Running', 'Football', 'Cricket', 'Basketball', 'Tennis', 'Padel', 'Golf',
  'Martial Arts', 'Dance', 'Religious observance', 'Classes / Course',
  'Childcare', 'Other',
]

interface EveningCommitment {
  days: string[]
  activity: string
  activity_other?: string
  start: string
  end: string
}

function EveningCommitmentsRepeater({
  value, onChange,
}: {
  value: EveningCommitment[]
  onChange: (v: EveningCommitment[]) => void
}) {
  const DAY_ABBR = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function addItem() {
    onChange([...value, { days: [], activity: '', activity_other: '', start: '', end: '' }])
  }

  function removeItem(i: number) {
    onChange(value.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, patch: Partial<EveningCommitment>) {
    onChange(value.map((item, idx) => idx === i ? { ...item, ...patch } : item))
  }

  function toggleDay(i: number, day: string) {
    const item = value[i]
    const days = item.days.includes(day) ? item.days.filter(d => d !== day) : [...item.days, day]
    updateItem(i, { days })
  }

  return (
    <div>
      {value.map((item, i) => (
        <div key={i} style={{
          backgroundColor: '#0d0d0d', border: '1px solid #1c1c1c', borderRadius: '14px',
          padding: '14px', marginBottom: '12px', position: 'relative',
        }}>
          <button
            onClick={() => removeItem(i)}
            style={{
              position: 'absolute', top: '10px', right: '10px',
              width: '24px', height: '24px', borderRadius: '6px',
              backgroundColor: '#1c1c1c', border: '1px solid #27272a',
              color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={12} />
          </button>
          <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '8px' }}>Days</div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {DAY_KEYS.map((day, di) => (
              <button
                key={day}
                onClick={() => toggleDay(i, day)}
                style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  border: item.days.includes(day) ? '1.5px solid #f97316' : '1.5px solid #27272a',
                  backgroundColor: item.days.includes(day) ? 'rgba(249,115,22,0.12)' : '#111',
                  color: item.days.includes(day) ? '#f97316' : '#71717a',
                  fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                {DAY_ABBR[di]}
              </button>
            ))}
          </div>
          <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '8px' }}>Activity</div>
          <select
            value={item.activity}
            onChange={e => updateItem(i, { activity: e.target.value })}
            style={{ ...selectStyle, marginBottom: '10px' }}
          >
            <option value="" style={{ background: '#111' }}>Select activity…</option>
            {ACTIVITY_OPTIONS.map(o => (
              <option key={o} value={o} style={{ background: '#111' }}>{o}</option>
            ))}
          </select>
          {item.activity === 'Other' && (
            <input
              type="text"
              value={item.activity_other ?? ''}
              onChange={e => updateItem(i, { activity_other: e.target.value })}
              placeholder="Describe activity…"
              style={{ ...inputStyle, marginBottom: '10px' }}
            />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>Start</div>
              <input type="time" value={item.start} onChange={e => updateItem(i, { start: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>End</div>
              <input type="time" value={item.end} onChange={e => updateItem(i, { end: e.target.value })} style={inputStyle} />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={addItem}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 18px', borderRadius: '100px',
          backgroundColor: 'rgba(249,115,22,0.08)', border: '1.5px dashed rgba(249,115,22,0.4)',
          color: '#f97316', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
        }}
      >
        <Plus size={14} /> Add commitment
      </button>
    </div>
  )
}

// ─── Summary generator ────────────────────────────────────────────────────────

function generateSummary(sectionData: Record<string, StepData | undefined>): string {
  const p = sectionData.physical ?? {}
  const l = sectionData.lifestyle_ext ?? {}
  const tr = sectionData.training_ext ?? {}
  const n = sectionData.nutrition_ext ?? {}
  const s = sectionData.supplements_ext ?? {}
  const sl = sectionData.sleep_ext ?? {}
  const sk = sectionData.skincare ?? {}
  const h = sectionData.hair ?? {}
  const m = sectionData.mental ?? {}
  const t = sectionData.travel ?? {}
  const tech = sectionData.tech_prefs ?? {}
  const c = sectionData.coaching ?? {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const arr = (v: any) => Array.isArray(v) ? v.join(', ') : (v ?? '—')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const val = (v: any) => v !== undefined && v !== null && v !== '' ? String(v) : '—'

  return `APEX — PROFILE SUMMARY
Generated: ${new Date().toLocaleDateString()}
═══════════════════════════════════════

PHYSICAL PROFILE
Primary goal: ${val(p.primary_goal)}
Secondary goal: ${val(p.secondary_goal)}
Sex: ${val(p.sex)}
Age: ${val(p.age)}
Height: ${val(p.height_cm)} cm
Current weight: ${val(p.current_weight_kg)} kg
Target weight: ${val(p.target_weight_kg)} kg
Body fat %: ${val(p.body_fat_pct)}%
Injuries: ${arr(p.injuries_list)}${p.injuries_detail ? '\n  Details: ' + p.injuries_detail : ''}
Health conditions: ${arr(p.health_conditions_list)}${p.health_conditions_detail ? '\n  Details: ' + p.health_conditions_detail : ''}
Country: ${val(p.country)}
City: ${p.city === 'Other' ? val(p.city_other) : val(p.city)}
Target event: ${val(p.target_event_name)}${p.target_event_date ? ' on ' + p.target_event_date : ''}

LIFESTYLE & SCHEDULE
Work schedule: ${arr(l.work_schedule)}
Weekday days: ${arr(l.weekday_days)}
Wake times: ${l.wake_times ? Object.entries(l.wake_times).map(([d, t]) => `${d}: ${t}`).join(', ') : '—'}
Bedtime (weeknights): ${val(l.sleep_target_weeknight)}
Social frequency: ${val(l.social_frequency)}
Social night: ${val(l.social_night)}
Daily self-care time: ${val(l.daily_self_care_time)}
Evening commitments: ${Array.isArray(l.evening_commitments_list) && (l.evening_commitments_list as EveningCommitment[]).length > 0
    ? (l.evening_commitments_list as EveningCommitment[]).map(ec => `${ec.activity} (${ec.days.join(',')}) ${ec.start}–${ec.end}`).join('; ')
    : '—'}

TRAINING & GYM
Experience: ${val(tr.training_experience)}
Fitness level: ${val(tr.fitness_level)}
Sessions/week: ${val(tr.sessions_per_week)}
Training days: ${arr(tr.training_days)}
Gym type: ${val(tr.gym_type)}
Gym name: ${val(tr.gym_name)}
Preferred time: ${val(tr.preferred_time)}
Cardio types: ${arr(tr.cardio_types)}
Sports: ${arr(tr.sports_list)}${tr.sports_other ? ', ' + tr.sports_other : ''}
Sports fixed days: ${tr.sports_fixed ? arr(tr.sports_fixed_days) : 'No fixed days'}
Weaknesses: ${arr(tr.weaknesses)}
Tracks workouts: ${val(tr.tracks_workouts)}${tr.tracking_app ? ' (' + tr.tracking_app + ')' : ''}

NUTRITION & DIET
Dietary style: ${val(n.diet_type)}
Dislikes: ${arr(n.dislikes_list)}
Enjoys cooking: ${val(n.enjoys_cooking)}/5
Protein sources: ${arr(n.protein_sources)}
Tracks calories: ${val(n.tracks_calories)}${n.tracking_app ? ' (' + n.tracking_app + ')' : ''}
Nutritional weaknesses: ${arr(n.weaknesses)}
Alcohol frequency: ${val(n.alcohol_frequency)}${n.alcohol_type ? ' — ' + n.alcohol_type : ''}
Non-negotiables: ${arr(n.non_negotiable_list)}${n.non_negotiable_other ? ', ' + n.non_negotiable_other : ''}
Caffeine: ${((n.coffee_daily as number) ?? 2) > 0 ? `${val(n.coffee_daily)} cups/day, cut-off ${val(n.coffee_cutoff)}` : 'None'}
Lunch location: ${val(n.lunch_location)}
Cuisines: ${arr(n.cuisine_list)}
Water: ${val(n.water_liters)}L/day
Uses electrolytes: ${val(n.uses_electrolytes)}

SUPPLEMENTS
Budget: ${val(s.budget)}
Format preference: ${arr(s.format_pref)}
Known deficiencies: ${arr(s.deficiencies_list)}
Considering: ${arr(s.considering_list)}
Medications: ${arr(s.medications_list)}${s.medications_other ? '\n  Other: ' + s.medications_other : ''}

SLEEP & RECOVERY
Avg sleep: ${val(sl.avg_sleep_hours)} hrs
Quality: ${val(sl.quality_rating)}/10
Sleep issues: ${arr(sl.sleep_issues)}
Pre-sleep routine: ${arr(sl.presleep_routine_list)}${sl.presleep_notes ? '\n  Notes: ' + sl.presleep_notes : ''}
Environment dark: ${val(sl.env_dark)}
Room cool: ${val(sl.env_cool)}
Sleep supplements/tools: ${arr(sl.sleep_supplements_list)}
Tracking device: ${val(sl.tracking_device)}
Recovery methods: ${arr(sl.recovery_methods)}

SKINCARE
Skin type: ${val(sk.skin_type)}
Concerns: ${arr(sk.skin_concerns)}
SPF: ${val(sk.spf)}
Actives: ${arr(sk.actives)}
Time/day: ${val(sk.time_willingness)}
Budget: ${val(sk.budget)}

HAIR
Hair type: ${arr(h.hair_type)}
Concerns: ${arr(h.hair_concerns)}
Wash frequency: ${val(h.wash_frequency)}
Scalp issues: ${arr(h.scalp_issues)}
Thinning concern: ${val(h.thinning_concern)}

MENTAL & STRESS
Work stress: ${val(m.work_stress)}/10
Stress drivers: ${val(m.stress_drivers)}
Stress impact: ${arr(m.stress_impact)}
Meditates: ${val(m.meditates)}${m.meditation_frequency ? ' — ' + m.meditation_frequency : ''}
Life satisfaction: ${val(m.life_satisfaction)}/10

TRAVEL & SOCIAL
Travel frequency: ${val(t.travel_frequency)}
Travel type: ${arr(t.travel_type)}
Appearance priority: ${val(t.appearance_priority)}/10

TECH & WEARABLES
Wearables: ${arr(tech.wearables)}
Apps: ${arr(tech.apps)}
Tech budget: ${val(tech.tech_budget)}
Tracked biometrics: ${arr(tech.tracked_biometrics)}

COACHING PREFERENCES
Plan setup preference: ${val(c.plan_setup_preference)}
Has coach: ${val(c.has_coach)}
Coaching style: ${val(c.coaching_style)}
Feedback bluntness: ${val(c.feedback_bluntness)}/5
Past derailers: ${arr(c.past_derailers)}
Has failed before: ${val(c.has_failed_before)}${c.failure_reason ? '\n  Reason: ' + c.failure_reason : ''}
Additional context: ${val(c.additional_context)}

═══════════════════════════════════════
End of profile summary
`
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function subtractHours(timeStr: string, hours: number): string {
  const [h, m] = timeStr.split(':').map(Number)
  let totalMins = h * 60 + m - hours * 60
  if (totalMins < 0) totalMins += 24 * 60
  const hh = Math.floor(totalMins / 60) % 24
  const mm = totalMins % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

function timeDiffHours(from: string, to: string): number {
  const [fh, fm] = from.split(':').map(Number)
  const [th, tm] = to.split(':').map(Number)
  let diff = (th * 60 + tm) - (fh * 60 + fm)
  if (diff < 0) diff += 24 * 60
  return Math.round(diff / 60 * 10) / 10
}

function avgTimeStr(times: string[]): string {
  const mins = times.map(t => { const [h, m] = t.split(':').map(Number); return h * 60 + m })
  const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length)
  return `${String(Math.floor(avg / 60) % 24).padStart(2, '0')}:${String(avg % 60).padStart(2, '0')}`
}

function estimateBodyFat(sex: string, fitnessLevel: string): number {
  if (sex === 'Female') {
    if (fitnessLevel === 'Advanced' || fitnessLevel === 'Athlete') return 20
    if (fitnessLevel === 'Intermediate') return 24
    return 28
  }
  if (fitnessLevel === 'Advanced' || fitnessLevel === 'Athlete') return 12
  if (fitnessLevel === 'Intermediate') return 17
  return 22
}

// ─── Step content components ───────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StepData = Record<string, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StepSetter = (k: string, v: any) => void

function PhysicalStep({ data, set, trainingData }: { data: StepData; set: StepSetter; trainingData?: StepData }) {
  const goalOptions = ['Fat Loss', 'Muscle Gain', 'Recomposition', 'Performance', 'General Health']
  const primaryGoal = data.primary_goal ?? ''
  const secondaryOptions = goalOptions.filter(o => o !== primaryGoal)

  const injuryOptions = [
    'Lower back pain', 'Knee issues', 'Shoulder impingement', 'Hip flexor tightness',
    'Ankle instability', 'Neck pain', 'Wrist issues', 'Elbow tendinitis', 'Rotator cuff',
    'Plantar fasciitis', 'Sciatica', 'Herniated disc', 'IT band syndrome', 'ACL/meniscus', 'None',
  ]

  const healthOptions = [
    'Type 2 Diabetes', 'Hypothyroidism', 'Hyperthyroidism', 'Hypertension', 'High cholesterol',
    'PCOS', 'Insulin resistance', 'Asthma', 'Sleep apnea', 'Celiac disease', 'IBS / IBD',
    'Anxiety / Depression', 'ADHD', 'Autoimmune condition', 'Heart condition', 'None',
  ]

  const country = data.country ?? ''
  const cityOptions = country ? getCitiesForCountry(country) : []
  const city = data.city ?? ''

  return (
    <>
      <Field label="Primary goal" hint="What are you working towards?">
        <Chips
          options={goalOptions}
          value={primaryGoal}
          onChange={v => {
            set('primary_goal', v)
            if (v === data.secondary_goal) set('secondary_goal', '')
          }}
        />
      </Field>

      {primaryGoal && (
        <Field label="Secondary goal" hint="Cannot match your primary goal">
          <Chips
            options={secondaryOptions}
            value={data.secondary_goal ?? ''}
            onChange={v => set('secondary_goal', v)}
          />
        </Field>
      )}

      <Field label="Biological sex">
        <Chips
          options={['Male', 'Female']}
          value={data.sex ?? ''}
          onChange={v => set('sex', v)}
        />
      </Field>

      {data.sex === 'Female' && (
        <>
          <Field label="Last period start date" hint="Used to track your cycle phase and personalise coaching">
            <input
              type="date"
              value={data.last_period_date ?? ''}
              onChange={e => set('last_period_date', e.target.value)}
              style={{
                width: '100%', backgroundColor: '#111', border: '1px solid #27272a',
                borderRadius: '10px', padding: '10px 14px', fontSize: '14px',
                color: data.last_period_date ? '#fff' : '#52525b', outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </Field>
          <Field label="Average cycle length" hint="Most cycles are 21–35 days">
            <Stepper
              value={data.avg_cycle_length_days ?? 28}
              onChange={v => set('avg_cycle_length_days', v)}
              min={21} max={40} suffix=" days"
            />
          </Field>
        </>
      )}

      <Field label="Age">
        <Stepper value={data.age ?? 25} onChange={v => set('age', v)} min={16} max={80} suffix=" yrs" />
      </Field>
      <Field label="Height">
        <Stepper value={data.height_cm ?? 175} onChange={v => set('height_cm', v)} min={140} max={220} suffix=" cm" />
      </Field>
      <Field label="Current weight">
        <Stepper value={data.current_weight_kg ?? 75} onChange={v => set('current_weight_kg', v)} min={40} max={200} suffix=" kg" />
      </Field>
      <Field label="Target weight">
        <Stepper value={data.target_weight_kg ?? 70} onChange={v => set('target_weight_kg', v)} min={40} max={200} suffix=" kg" />
        {data.primary_goal === 'Fat Loss' && (data.target_weight_kg ?? 70) >= (data.current_weight_kg ?? 75) && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#f97316', backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '8px', padding: '8px 12px' }}>
            For fat loss, target weight should be below your current weight.
          </div>
        )}
        {data.primary_goal === 'Muscle Gain' && (data.target_weight_kg ?? 70) <= (data.current_weight_kg ?? 75) && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '8px', padding: '8px 12px' }}>
            For muscle gain, your target is typically above your current weight.
          </div>
        )}
      </Field>

      <Field label="Estimated body fat %" hint="Rough estimate is fine">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: '#71717a' }}>Not sure?</span>
          <Toggle
            value={data.body_fat_not_sure ?? false}
            labelOn="Estimate for me"
            labelOff="I'll enter it"
            onChange={v => {
              set('body_fat_not_sure', v)
              if (v) {
                const est = estimateBodyFat(data.sex ?? 'Male', (trainingData ?? {}).fitness_level ?? '')
                set('body_fat_pct', est)
              }
            }}
          />
        </div>
        <div style={{ opacity: data.body_fat_not_sure ? 0.5 : 1, pointerEvents: data.body_fat_not_sure ? 'none' : 'auto' }}>
          <Stepper value={data.body_fat_pct ?? 20} onChange={v => { set('body_fat_pct', v); set('body_fat_not_sure', false) }} min={5} max={50} suffix="%" />
        </div>
        {data.body_fat_not_sure && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: '#52525b' }}>Estimated from your sex &amp; fitness level — tap the stepper to override.</div>
        )}
        <BodyFatVisual sex={data.sex ?? 'Male'} value={data.body_fat_pct ?? 20} />
      </Field>

      <Field label="Injuries or physical limitations" hint="Select all that apply">
        <Chips
          options={injuryOptions}
          value={data.injuries_list ?? []}
          onChange={v => set('injuries_list', v)}
          multi
        />
        <div style={{ marginTop: '12px' }}>
          <textarea
            value={data.injuries_detail ?? ''}
            onChange={e => set('injuries_detail', e.target.value)}
            placeholder="Any additional details?"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>
      </Field>

      <Field label="Diagnosed health conditions" hint="Optional — used by the AI coach only">
        <Chips
          options={healthOptions}
          value={data.health_conditions_list ?? []}
          onChange={v => set('health_conditions_list', v)}
          multi
        />
        <div style={{ marginTop: '12px' }}>
          <textarea
            value={data.health_conditions_detail ?? ''}
            onChange={e => set('health_conditions_detail', e.target.value)}
            placeholder="Any additional details or medications?"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>
      </Field>

      <Field label="Where do you live?">
        <select
          value={country}
          onChange={e => {
            set('country', e.target.value)
            set('city', '')
            set('city_other', '')
          }}
          style={selectStyle}
        >
          <option value="" style={{ background: '#111' }}>Select country…</option>
          {COUNTRIES.map(c => (
            <option key={c} value={c} style={{ background: '#111' }}>{c}</option>
          ))}
        </select>
      </Field>

      {country && (
        <Field label="City">
          <select
            value={city}
            onChange={e => {
              set('city', e.target.value)
              set('city_other', '')
            }}
            style={{ ...selectStyle, marginBottom: city === 'Other' ? '10px' : '0' }}
          >
            <option value="" style={{ background: '#111' }}>Select city…</option>
            {cityOptions.map(c => (
              <option key={c} value={c} style={{ background: '#111' }}>{c}</option>
            ))}
          </select>
          {city === 'Other' && (
            <input
              type="text"
              value={data.city_other ?? ''}
              onChange={e => set('city_other', e.target.value)}
              placeholder="Enter your city…"
              style={inputStyle}
            />
          )}
        </Field>
      )}

      <Field label="Target event" hint="Anything you're training towards (optional)">
        <input
          type="text"
          value={data.target_event_name ?? ''}
          onChange={e => set('target_event_name', e.target.value)}
          placeholder="E.g. Tomorrowland 2025, half marathon…"
          style={{ ...inputStyle, marginBottom: '10px' }}
        />
        <input
          type="date"
          value={data.target_event_date ?? ''}
          onChange={e => set('target_event_date', e.target.value)}
          style={inputStyle}
        />
      </Field>
    </>
  )
}

function LifestyleStep({ data, set }: { data: StepData; set: StepSetter }) {
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const weekdayDays: string[] = data.weekday_days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  const weekendDays = ALL_DAYS.filter(d => !weekdayDays.includes(d))
  const wakeTimes: Record<string, string> = data.wake_times ?? {}

  function setWakeTime(day: string, time: string) {
    set('wake_times', { ...wakeTimes, [day]: time })
  }

  return (
    <>
      <Field label="Work schedule" hint="How demanding is it?">
        <Chips
          options={['9-5 Standard', 'Long hours', 'Shift work', 'Freelance/flexible', 'Remote']}
          value={data.work_schedule ?? []}
          onChange={v => set('work_schedule', v)}
          multi
        />
      </Field>

      <Field label="Which days are your weekdays?" hint="The remaining days become your weekend">
        <Chips
          options={ALL_DAYS}
          value={weekdayDays}
          onChange={v => set('weekday_days', v)}
          multi
        />
        {weekendDays.length > 0 && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#52525b' }}>
            Weekend days: {weekendDays.join(', ')}
          </div>
        )}
      </Field>

      <Field label="Wake time per day">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {ALL_DAYS.map(day => (
            <div key={day}>
              <div style={{ fontSize: '12px', color: weekdayDays.includes(day) ? '#f97316' : '#71717a', marginBottom: '4px', fontWeight: 500 }}>
                {day} {weekdayDays.includes(day) ? '' : '(wknd)'}
              </div>
              <input
                type="time"
                value={wakeTimes[day] ?? (weekdayDays.includes(day) ? '07:30' : '09:00')}
                onChange={e => setWakeTime(day, e.target.value)}
                style={inputStyle}
              />
            </div>
          ))}
        </div>
      </Field>

      <Field label="Target bedtime (weeknights)">
        <input type="time" value={data.sleep_target_weeknight ?? '23:30'} onChange={e => set('sleep_target_weeknight', e.target.value)} style={inputStyle} />
      </Field>

      <Field label="Fixed evening commitments" hint="Add recurring activities with their days and times">
        <EveningCommitmentsRepeater
          value={data.evening_commitments_list ?? []}
          onChange={v => set('evening_commitments_list', v)}
        />
      </Field>

      <Field label="How often do you go out / have late nights?">
        <Chips
          options={['Rarely', 'Once a month', 'Most weekends', 'Multiple nights/week']}
          value={data.social_frequency ?? ''}
          onChange={v => set('social_frequency', v)}
        />
      </Field>
      <Field label="Your usual social night">
        <Chips
          options={['Friday', 'Saturday', 'Both', 'Varies']}
          value={data.social_night ?? ''}
          onChange={v => set('social_night', v)}
        />
      </Field>
      <Field label="How much time can you realistically dedicate to gym + meals daily?">
        <Chips
          options={['< 1 hour', '1–2 hours', '2–3 hours', '3+ hours']}
          value={data.daily_self_care_time ?? ''}
          onChange={v => set('daily_self_care_time', v)}
        />
      </Field>
    </>
  )
}

const GOAL_SESSION_MAP: Record<string, number> = {
  'Fat Loss': 4,
  'Muscle Gain': 5,
  'Recomposition': 4,
  'Performance': 5,
  'General Health': 3,
}

function TrainingStep({ data, set, physicalData, lifestyleData }: {
  data: StepData; set: StepSetter; physicalData?: StepData; lifestyleData?: StepData
}) {
  const [showScheduleSuggestion, setShowScheduleSuggestion] = useState(false)
  const [scheduleApplied, setScheduleApplied] = useState(false)

  // Auto-sync sessions_per_week when training days are selected
  useEffect(() => {
    const days: string[] = data.training_days ?? []
    if (days.length > 0 && days.length !== (data.sessions_per_week ?? 4)) {
      set('sessions_per_week', days.length)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.training_days])

  // Auto-suggest fitness level from training experience (only if not yet set)
  useEffect(() => {
    if (data.fitness_level || !data.training_experience) return
    const map: Record<string, string> = {
      '< 1 year': 'Beginner',
      '1–2 years': 'Intermediate',
      '2–5 years': 'Intermediate',
      '5–10 years': 'Advanced',
      '10+ years': 'Advanced',
    }
    const suggested = map[data.training_experience]
    if (suggested) set('fitness_level', suggested)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.training_experience])

  // Compute schedule suggestion from goal + lifestyle
  const goal = physicalData?.primary_goal as string | undefined
  const commitments: EveningCommitment[] = (lifestyleData?.evening_commitments_list as EveningCommitment[] | undefined) ?? []
  const busyDays = new Set(commitments.flatMap(c => c.days ?? []))
  const ALL_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const suggestedCount = goal ? (GOAL_SESSION_MAP[goal] ?? 4) : 4
  const freeDays = ALL_DAYS.filter(d => !busyDays.has(d))
  const scheduledDays: string[] = []
  // Fill from free days first, then busy if needed, spreading through the week
  const pool = [...freeDays, ...ALL_DAYS.filter(d => busyDays.has(d))]
  // Prefer a spread pattern: avoid consecutive rest days gap > 2
  for (const d of pool) {
    if (scheduledDays.length >= suggestedCount) break
    scheduledDays.push(d)
  }
  const hasScheduleContext = !!goal

  function applyScheduleSuggestion() {
    set('sessions_per_week', suggestedCount)
    set('training_days', scheduledDays)
    setShowScheduleSuggestion(false)
    setScheduleApplied(true)
  }

  const sportsOptions = [
    'Football', 'Cricket', 'Basketball', 'Tennis', 'Padel', 'Golf', 'Swimming',
    'Cycling', 'Running', 'Martial Arts', 'Boxing', 'Yoga', 'Pilates', 'Dance',
    'Hiking', 'Rock climbing', 'Skiing / Snowboarding', 'Surfing', 'Rowing',
    'Rugby', 'Baseball', 'Volleyball', 'None', 'Other',
  ]

  const gymTypes = [
    'No gym / home only', 'Basic hotel/apartment gym', 'Small local gym',
    'Commercial gym (basic)', 'Commercial gym (well-equipped)', 'Large chain gym',
    'Premium gym / boutique', 'High-performance facility', 'CrossFit box',
  ]

  const sportsList: string[] = data.sports_list ?? []
  const sportsFixed: boolean = data.sports_fixed ?? false

  return (
    <>
      <Field label="How long have you been training?">
        <Chips
          options={['< 1 year', '1–2 years', '2–5 years', '5–10 years', '10+ years']}
          value={data.training_experience ?? ''}
          onChange={v => set('training_experience', v)}
        />
      </Field>
      <Field label="Honest fitness level">
        <Chips
          options={['Beginner', 'Intermediate', 'Advanced', 'Athlete']}
          value={data.fitness_level ?? ''}
          onChange={v => set('fitness_level', v)}
        />
      </Field>
      <Field label="Sessions per week you can realistically commit to">
        <Stepper value={data.sessions_per_week ?? 4} onChange={v => set('sessions_per_week', v)} min={1} max={7} suffix="x" />
      </Field>
      <Field label="Which days do you train?" hint="Select all that apply">
        <Chips
          options={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
          value={data.training_days ?? []}
          onChange={v => set('training_days', v)}
          multi
        />
      </Field>

      <Field label="Gym type">
        <Chips
          options={gymTypes}
          value={data.gym_type ?? ''}
          onChange={v => set('gym_type', v)}
        />
      </Field>

      <Field label="Your gym (optional)">
        <input
          type="text"
          value={data.gym_name ?? ''}
          onChange={e => set('gym_name', e.target.value)}
          placeholder="E.g. Fitness First, home gym, TopGym"
          style={inputStyle}
        />
      </Field>

      <Field label="Preferred training time">
        <Chips
          options={['Morning', 'Lunchtime', 'Evening', 'Late night', 'Varies']}
          value={data.preferred_time ?? ''}
          onChange={v => set('preferred_time', v)}
        />
      </Field>
      <Field label="Cardio — what do you do?">
        <Chips
          options={['Stairmaster', 'Treadmill', 'Cycling', 'Running outdoors', 'Swimming', 'HIIT', 'None']}
          value={data.cardio_types ?? []}
          onChange={v => set('cardio_types', v)}
          multi
        />
      </Field>

      <Field label="Sports or physical activity outside the gym">
        <Chips
          options={sportsOptions}
          value={sportsList}
          onChange={v => set('sports_list', v)}
          multi
        />
        {sportsList.includes('Other') && (
          <div style={{ marginTop: '12px' }}>
            <input
              type="text"
              value={data.sports_other ?? ''}
              onChange={e => set('sports_other', e.target.value)}
              placeholder="Describe other sport/activity…"
              style={inputStyle}
            />
          </div>
        )}
        {sportsList.length > 0 && !sportsList.every(s => s === 'None') && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: '#a1a1aa' }}>Do you do this on fixed days?</span>
              <Toggle
                value={sportsFixed}
                onChange={v => set('sports_fixed', v)}
              />
            </div>
            {sportsFixed && (
              <Chips
                options={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
                value={data.sports_fixed_days ?? []}
                onChange={v => set('sports_fixed_days', v)}
                multi
              />
            )}
          </div>
        )}
      </Field>

      <Field label="Weakest areas / what you most want to prioritise">
        <Chips
          options={['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Flexibility', 'Consistency']}
          value={data.weaknesses ?? []}
          onChange={v => set('weaknesses', v)}
          multi
        />
      </Field>
      <Field label="Do you currently track workouts?">
        <Toggle value={data.tracks_workouts ?? false} onChange={v => set('tracks_workouts', v)} />
      </Field>
      {data.tracks_workouts && (
        <Field label="What app or method?">
          <input
            type="text"
            value={data.tracking_app ?? ''}
            onChange={e => set('tracking_app', e.target.value)}
            placeholder="E.g. Strong, Hevy, notes, this app"
            style={inputStyle}
          />
        </Field>
      )}

      {/* Schedule suggestion — shown at the bottom after all preferences are set */}
      {hasScheduleContext && (
        <div style={{ marginTop: '8px' }}>
          {/* Applied compact state */}
          {scheduleApplied && !showScheduleSuggestion && (
            <div style={{
              backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: '14px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Check size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#60a5fa', marginBottom: '4px' }}>Schedule applied</div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {scheduledDays.map(d => (
                      <span key={d} style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                        backgroundColor: 'rgba(59,130,246,0.15)', color: '#93c5fd',
                      }}>{d}</span>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleSuggestion(true)}
                style={{
                  flexShrink: 0, padding: '6px 12px', borderRadius: '8px',
                  backgroundColor: 'transparent', border: '1px solid rgba(59,130,246,0.3)',
                  color: '#60a5fa', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                Change
              </button>
            </div>
          )}

          {/* Suggestion prompt button (initial state) */}
          {!scheduleApplied && !showScheduleSuggestion && (
            <button
              onClick={() => setShowScheduleSuggestion(true)}
              style={{
                width: '100%', backgroundColor: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.25)', borderRadius: '12px',
                padding: '12px 16px', cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#60a5fa' }}>✦ Suggest my training schedule</div>
                <div style={{ fontSize: '11px', color: '#52525b', marginTop: '2px' }}>
                  Based on your {goal} goal{busyDays.size > 0 ? ' and your weekly commitments' : ''}
                </div>
              </div>
              <ChevronRight size={16} color="#60a5fa" />
            </button>
          )}

          {/* Expanded suggestion card */}
          {showScheduleSuggestion && (
            <div style={{
              backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
              borderRadius: '14px', padding: '16px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa', marginBottom: '12px' }}>Suggested schedule</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {scheduledDays.map(d => (
                  <span key={d} style={{
                    padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    backgroundColor: 'rgba(59,130,246,0.15)', color: '#93c5fd',
                  }}>{d}</span>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: '#71717a', lineHeight: 1.5, marginBottom: '12px' }}>
                {suggestedCount} sessions/week for {goal?.toLowerCase() ?? 'your goal'}{busyDays.size > 0 ? `, avoiding your ${[...busyDays].join(', ')} commitments` : ''}.
              </p>
              <p style={{ fontSize: '11px', color: '#3f3f46', lineHeight: 1.5, marginBottom: '12px' }}>
                You can still edit your days and session count above after applying.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={applyScheduleSuggestion} style={{
                  flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
                  backgroundColor: '#3b82f6', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>Apply this schedule</button>
                <button onClick={() => setShowScheduleSuggestion(false)} style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  backgroundColor: 'transparent', border: '1px solid #27272a',
                  color: '#52525b', fontSize: '13px', cursor: 'pointer',
                }}>Dismiss</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function NutritionStep({ data, set, lifestyleData, physicalData, trainingData, whoopData }: {
  data: StepData; set: StepSetter; lifestyleData?: StepData; physicalData?: StepData; trainingData?: StepData; whoopData?: WhoopContext | null
}) {
  const dietType = data.diet_type ?? ''
  const [macroCard, setMacroCard] = useState<MacroResult | null>(null)
  const [macroLoading, setMacroLoading] = useState(false)
  const [macroApplied, setMacroApplied] = useState(false)

  const goal = physicalData?.primary_goal as string | undefined
  const hasEnoughForMacros = !!(physicalData?.current_weight_kg && physicalData?.height_cm && physicalData?.age)

  async function calculateMacros() {
    setMacroLoading(true)
    setMacroCard(null)
    try {
      const res = await fetch('/api/ai/calculate-macros', { method: 'POST' })
      const d = await res.json() as MacroResult & { error?: string }
      if (!d.error) setMacroCard(d)
    } finally {
      setMacroLoading(false)
    }
  }

  async function applyMacros() {
    if (!macroCard) return
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ table: 'user_goals', data: { daily_calorie_target: macroCard.calories, daily_protein_target_g: macroCard.protein_g } }),
    })
    // Auto-fill water based on weight
    const weightKg = physicalData?.current_weight_kg as number | undefined
    if (weightKg && !(data.water_liters)) {
      const sessions = (trainingData?.sessions_per_week as number | undefined) ?? 0
      set('water_liters', Math.round((weightKg * 0.033 + sessions * 0.5) * 2) / 2)
    }
    setMacroApplied(true)
    setMacroCard(null)
  }

  // Auto-fill caffeine cutoff based on target bedtime (6 hrs before sleep)
  useEffect(() => {
    const bedtime = lifestyleData?.sleep_target_weeknight
    const coffeeDaily = data.coffee_daily ?? 2
    if (coffeeDaily > 0 && bedtime && (!data.coffee_cutoff || data.coffee_cutoff === '16:00')) {
      set('coffee_cutoff', subtractHours(bedtime, 6))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifestyleData?.sleep_target_weeknight, data.coffee_daily])

  // Auto-add/remove "Drinking too much" weakness based on alcohol frequency
  useEffect(() => {
    const freq = data.alcohol_frequency
    const current: string[] = data.weaknesses ?? []
    const tag = 'Drinking too much'
    const highFreq = freq === '2–3x per week' || freq === 'Daily'
    if (highFreq && !current.includes(tag)) {
      set('weaknesses', [...current, tag])
    } else if (!highFreq && current.includes(tag)) {
      set('weaknesses', current.filter(w => w !== tag))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.alcohol_frequency])

  // Filter protein sources by dietary style
  let proteinSources = ['Chicken', 'Beef', 'Fish', 'Eggs', 'Greek yoghurt', 'Cottage cheese', 'Tofu', 'Legumes', 'Protein powder']
  if (dietType === 'Vegan') {
    proteinSources = ['Tofu', 'Tempeh', 'Legumes', 'Protein powder', 'Seitan', 'Edamame']
  } else if (dietType === 'Vegetarian') {
    proteinSources = proteinSources.filter(s => !['Chicken', 'Beef', 'Fish'].includes(s))
  } else if (dietType === 'Halal') {
    proteinSources = proteinSources.filter(s => s !== 'Pork')
  } else if (dietType === 'Pescatarian') {
    proteinSources = proteinSources.filter(s => !['Chicken', 'Beef'].includes(s))
  }
  const showProteinHint = !!dietType

  // Filter dislikes by dietary style
  let dislikesBase = [
    'Mushrooms', 'Liver / offal', 'Anchovies', 'Olives', 'Blue cheese', 'Tofu', 'Tempeh',
    'Seaweed', 'Bitter vegetables', 'Spicy food', 'Raw onion', 'Garlic', 'Cilantro/coriander',
    'Eggs', 'Fish', 'Red meat', 'Pork', 'Shellfish', 'Dairy', 'Legumes', 'Gluten/wheat',
  ]
  if (dietType === 'Vegan') {
    dislikesBase = dislikesBase.filter(d => !['Eggs', 'Fish', 'Red meat', 'Pork', 'Shellfish', 'Dairy'].includes(d))
  } else if (dietType === 'Vegetarian') {
    dislikesBase = dislikesBase.filter(d => !['Fish', 'Red meat', 'Pork', 'Shellfish'].includes(d))
  }

  const nonNegotiableOptions = [
    'Dark chocolate', 'Pizza (weekly)', 'Ice cream', 'Chips / crisps', 'Bread / toast',
    'Pasta', 'Rice', 'Cheese', 'Alcohol', 'Desserts', 'Caffeine', 'Fruit',
    'Peanut butter', 'Protein bars', 'Fast food (weekly)', 'Takeaway', 'None', 'Other',
  ]

  const cuisineOptions = [
    'Indian', 'Middle Eastern / Lebanese', 'Italian', 'Japanese', 'Chinese', 'Mexican',
    'Mediterranean', 'Thai', 'American', 'British', 'Turkish', 'Greek', 'Korean',
    'Vietnamese', 'French', 'Pakistani', 'African',
  ]

  const nonNegList: string[] = data.non_negotiable_list ?? []

  return (
    <>
      <Field label="Dietary style">
        <Chips
          options={['Omnivore', 'Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Keto', 'Flexible']}
          value={dietType}
          onChange={v => set('diet_type', v)}
        />
      </Field>

      <Field label="Foods you dislike or won't eat">
        <Chips
          options={dislikesBase}
          value={data.dislikes_list ?? []}
          onChange={v => set('dislikes_list', v)}
          multi
        />
      </Field>

      <Field label="How much do you enjoy cooking?" hint="1 = hate it, 5 = love it">
        <RangeSlider value={data.enjoys_cooking ?? 3} onChange={v => set('enjoys_cooking', v)} min={1} max={5} />
      </Field>

      <Field label="Go-to protein sources at home" hint={showProteinHint ? 'Filtered by your dietary style' : undefined}>
        <Chips
          options={proteinSources}
          value={data.protein_sources ?? []}
          onChange={v => set('protein_sources', v)}
          multi
        />
      </Field>

      <Field label="Do you track calories or macros?">
        <Toggle value={data.tracks_calories ?? false} onChange={v => set('tracks_calories', v)} />
      </Field>
      {data.tracks_calories && (
        <Field label="Which app?">
          <input
            type="text"
            value={data.tracking_app ?? ''}
            onChange={e => set('tracking_app', e.target.value)}
            placeholder="E.g. MyFitnessPal, Cronometer, this app"
            style={inputStyle}
          />
        </Field>
      )}

      <Field label="Your biggest nutritional weaknesses">
        <Chips
          options={['Late-night snacking', 'Skipping meals', 'Eating out too much', 'Too many carbs', 'Not enough protein', 'Drinking too much', 'Emotional eating', 'Portion sizes']}
          value={data.weaknesses ?? []}
          onChange={v => set('weaknesses', v)}
          multi
        />
      </Field>

      <Field label="Alcohol — how often?">
        <Chips
          options={['Never', 'Rarely', 'Weekends only', '2–3x per week', 'Daily']}
          value={data.alcohol_frequency ?? ''}
          onChange={v => set('alcohol_frequency', v)}
        />
      </Field>
      {data.alcohol_frequency && !['Never', 'Rarely'].includes(data.alcohol_frequency) && (
        <Field label="What do you drink?">
          <input
            type="text"
            value={data.alcohol_type ?? ''}
            onChange={e => set('alcohol_type', e.target.value)}
            placeholder="E.g. beer, wine, spirits, cocktails"
            style={inputStyle}
          />
        </Field>
      )}

      <Field label="Non-negotiable foods or treats">
        <Chips
          options={nonNegotiableOptions}
          value={nonNegList}
          onChange={v => set('non_negotiable_list', v)}
          multi
        />
        {nonNegList.includes('Other') && (
          <div style={{ marginTop: '12px' }}>
            <input
              type="text"
              value={data.non_negotiable_other ?? ''}
              onChange={e => set('non_negotiable_other', e.target.value)}
              placeholder="Describe other non-negotiable…"
              style={inputStyle}
            />
          </div>
        )}
      </Field>

      <Field label="Caffeine — cups per day">
        <Stepper value={data.coffee_daily ?? 2} onChange={v => set('coffee_daily', v)} min={0} max={10} suffix=" cups" />
      </Field>
      {(data.coffee_daily ?? 2) > 0 && (
        <Field label="Caffeine cut-off time" hint="Last caffeine intake — helps protect your sleep">
          <input type="time" value={data.coffee_cutoff ?? '16:00'} onChange={e => set('coffee_cutoff', e.target.value)} style={inputStyle} />
        </Field>
      )}
      <Field label="Where do you typically eat lunch?">
        <Chips
          options={['Home', 'Office (packed)', 'Office canteen', 'Restaurants', 'Takeaway']}
          value={data.lunch_location ?? ''}
          onChange={v => set('lunch_location', v)}
        />
      </Field>

      <Field label="Cuisines you frequently eat">
        <Chips
          options={cuisineOptions}
          value={data.cuisine_list ?? []}
          onChange={v => set('cuisine_list', v)}
          multi
        />
      </Field>

      {/* AI macro + water calculator */}
      {hasEnoughForMacros && (
        <div style={{ marginBottom: '24px' }}>
          {!macroCard && !macroApplied && (
            <button
              onClick={calculateMacros}
              disabled={macroLoading}
              style={{
                width: '100%', backgroundColor: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.25)', borderRadius: '12px',
                padding: '12px 16px', cursor: macroLoading ? 'not-allowed' : 'pointer',
                textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                opacity: macroLoading ? 0.7 : 1,
              }}
            >
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>
                  {macroLoading ? 'Calculating…' : '✦ Calculate my calorie & macro targets'}
                </div>
                <div style={{ fontSize: '11px', color: '#52525b', marginTop: '2px' }}>
                  Uses your {goal ? `${goal} goal` : 'goal'}, weight, training load{whoopData?.avgKilojoules ? ' + WHOOP energy data' : ''}
                </div>
              </div>
              {!macroLoading && <ChevronRight size={16} color="#34d399" />}
            </button>
          )}
          {macroApplied && (
            <div style={{
              backgroundColor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <Check size={14} color="#34d399" />
              <span style={{ fontSize: '13px', color: '#34d399', fontWeight: 600 }}>Targets saved to your goals</span>
            </div>
          )}
          {macroCard && (
            <div style={{
              backgroundColor: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: '14px', padding: '16px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#34d399', marginBottom: '12px' }}>AI Recommendation</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                {[
                  { label: 'Calories', value: String(macroCard.calories) },
                  { label: 'Protein', value: `${macroCard.protein_g}g` },
                  { label: 'Carbs', value: `${macroCard.carbs_g}g` },
                  { label: 'Fats', value: `${macroCard.fats_g}g` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ backgroundColor: '#181818', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', color: '#52525b', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{value}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: '#71717a', lineHeight: 1.6, marginBottom: '12px' }}>{macroCard.explanation}</p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={applyMacros} style={{
                  flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
                  backgroundColor: '#10b981', color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                }}>Apply targets</button>
                <button onClick={() => setMacroCard(null)} style={{
                  flex: 1, padding: '10px', borderRadius: '10px',
                  backgroundColor: 'transparent', border: '1px solid #27272a',
                  color: '#52525b', fontSize: '13px', cursor: 'pointer',
                }}>Skip</button>
              </div>
            </div>
          )}
        </div>
      )}

      <Field label="Daily water intake">
        <Stepper value={data.water_liters ?? 2} onChange={v => set('water_liters', v)} min={0} max={8} step={1} suffix="L" />
      </Field>
      <Field label="Do you use electrolytes?">
        <Toggle value={data.uses_electrolytes ?? false} onChange={v => set('uses_electrolytes', v)} />
      </Field>
    </>
  )
}

function SupplementsStep({ data, set, physicalData, nutritionData, sleepData, mentalData, trainingData }: {
  data: StepData; set: StepSetter; physicalData?: StepData; nutritionData?: StepData; sleepData?: StepData; mentalData?: StepData; trainingData?: StepData
}) {
  // Auto-add supplements matched to known deficiencies
  useEffect(() => {
    const deficiencyMap: Record<string, string> = {
      'Vitamin D': 'Vitamin D3',
      'Magnesium': 'Magnesium glycinate',
      'Zinc': 'Zinc',
      'Omega-3': 'Omega-3 / Fish oil',
    }
    const deficiencies: string[] = data.deficiencies_list ?? []
    const current: string[] = data.considering_list ?? []
    const toAdd = deficiencies
      .map(d => deficiencyMap[d])
      .filter((s): s is string => !!s && !current.includes(s))
    if (toAdd.length > 0) {
      set('considering_list', [...current, ...toAdd])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.deficiencies_list])

  // Build smart suggestions with reasons based on all prior context
  const goal = physicalData?.primary_goal as string | undefined
  const sex = physicalData?.sex as string | undefined
  const dietType = nutritionData?.diet_type as string | undefined
  const sleepIssues: string[] = (sleepData?.sleep_issues as string[] | undefined) ?? []
  const sleepQuality = sleepData?.quality_rating as number | undefined
  const stress = mentalData?.work_stress as number | undefined
  const sessions = trainingData?.sessions_per_week as number | undefined
  const preferredTime = trainingData?.preferred_time as string | undefined

  const isVegetarianOrVegan = dietType === 'Vegetarian' || dietType === 'Vegan'
  const isVegan = dietType === 'Vegan'
  const hasSleepIssues = sleepIssues.some(i => ['Hard to fall asleep', 'Wake up during night', 'Wake unrefreshed'].includes(i))
  const poorSleep = (sleepQuality !== undefined && sleepQuality < 6) || hasSleepIssues
  const highStress = stress !== undefined && stress >= 7
  const isMuscleOrPerf = goal === 'Muscle Gain' || goal === 'Performance'
  const trainsFrequently = sessions !== undefined && sessions >= 4
  const morningTrainer = preferredTime === 'Morning'

  const budgetTier = data.budget as string | undefined
  const lowBudget = budgetTier === '< $50'

  interface SmartSuggestion { name: string; reason: string; priority: number }
  const suggestions: SmartSuggestion[] = []

  if (isMuscleOrPerf || trainsFrequently)
    suggestions.push({ name: 'Creatine', reason: `${goal ?? 'Training'} goal — most evidence-backed supplement for muscle output`, priority: 1 })
  if (isVegetarianOrVegan)
    suggestions.push({ name: 'Omega-3 / Fish oil', reason: 'No oily fish in your diet — essential for inflammation and brain health', priority: 2 })
  if (isVegan)
    suggestions.push({ name: 'Vitamin D3', reason: 'Vegan diet has no dietary D3 sources', priority: 1 })
  if (isVegan && sex === 'Female')
    suggestions.push({ name: 'Magnesium glycinate', reason: 'Vegan women commonly under-consume magnesium', priority: 2 })
  if (poorSleep || hasSleepIssues)
    suggestions.push({ name: 'Magnesium glycinate', reason: sleepIssues.includes('Hard to fall asleep') ? 'Helps with sleep onset — matches your reported issues' : 'Poor sleep quality — magnesium supports deeper sleep', priority: 1 })
  if (sleepIssues.includes('Hard to fall asleep') && (sleepQuality ?? 10) < 6)
    suggestions.push({ name: 'Melatonin', reason: 'Hard to fall asleep + low sleep quality — short-term onset support', priority: 2 })
  if (highStress)
    suggestions.push({ name: 'Ashwagandha', reason: `Stress level ${stress}/10 — ashwagandha is clinically shown to reduce cortisol`, priority: 2 })
  if (morningTrainer && trainsFrequently)
    suggestions.push({ name: 'Caffeine / pre-workout', reason: 'Morning training sessions — supports energy and output', priority: 3 })
  if (goal === 'Fat Loss' && !isVegetarianOrVegan)
    suggestions.push({ name: 'Omega-3 / Fish oil', reason: 'Supports fat oxidation and appetite regulation during a cut', priority: 3 })

  // Deduplicate and sort by priority
  const seen = new Set<string>()
  const dedupedSuggestions = suggestions.filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true })
  const cappedSuggestions = lowBudget ? dedupedSuggestions.slice(0, 3) : dedupedSuggestions

  // Auto-apply suggestions not already in considering_list on first load
  useEffect(() => {
    if (cappedSuggestions.length === 0) return
    const current: string[] = data.considering_list ?? []
    const toAdd = cappedSuggestions.map(s => s.name).filter(n => !current.includes(n))
    if (toAdd.length > 0) set('considering_list', [...current, ...toAdd])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, dietType, sleepIssues.join(), stress, sessions, preferredTime])

  const consideringOptions = [
    'Creatine', 'Whey protein', 'Collagen', 'Omega-3 / Fish oil', 'Vitamin D3',
    'Magnesium glycinate', 'Zinc', 'Ashwagandha', "Lion's mane", 'NMN / NR', 'CoQ10',
    'Berberine', 'Probiotics', 'Prebiotics', 'L-glutamine', 'BCAA', 'Beta-alanine',
    'Caffeine / pre-workout', 'Melatonin', 'Turkesterone', 'Tongkat Ali', 'Not sure',
  ]

  const deficiencyOptions = [
    'Vitamin D', 'Iron', 'B12', 'Ferritin', 'Folate', 'Zinc', 'Magnesium',
    'Omega-3', 'Iodine', 'Calcium', 'None known',
  ]

  const medOptions = [
    'Metformin', 'Statins', 'Beta blockers', 'Antidepressants / SSRIs', 'Thyroid medication',
    'Blood pressure medication', 'Contraceptive pill', 'Hormone therapy (TRT/HRT)',
    'Anticoagulants', 'Immunosuppressants', 'Steroids / Corticosteroids', 'ADHD medication',
    'Diabetes medication', 'Antipsychotics', 'None',
  ]

  return (
    <>
      {cappedSuggestions.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: '14px', padding: '16px', marginBottom: '20px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Suggested for you
          </div>
          {cappedSuggestions.map(s => (
            <div key={s.name} style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              padding: '8px 0', borderBottom: '1px solid #1a1a1a',
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: '#f59e0b', marginTop: '5px', flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{s.name}</div>
                <div style={{ fontSize: '11px', color: '#71717a', marginTop: '2px', lineHeight: 1.4 }}>{s.reason}</div>
              </div>
            </div>
          ))}
          <div style={{ fontSize: '11px', color: '#52525b', marginTop: '10px' }}>
            These have been pre-selected in the list below. You can remove any that don&apos;t apply.
          </div>
        </div>
      )}

      <div style={{ backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '16px', padding: '16px', marginBottom: '24px' }}>
        <div style={{ fontSize: '13px', color: '#71717a', lineHeight: '1.6' }}>
          Your supplement stack is managed in <strong style={{ color: '#f97316' }}>Settings → Supplement Stack</strong>. Add your supplements there for daily tracking. Answer the questions below to help the AI coach personalise your recommendations.
        </div>
      </div>

      <Field label="Monthly budget for supplements">
        <Chips
          options={['< $50', '$50–$100', '$100–$200', '$200–$400', '$400+']}
          value={data.budget ?? ''}
          onChange={v => set('budget', v)}
        />
      </Field>
      <Field label="Preferred format">
        <Chips
          options={['Capsules', 'Powder', 'Liquid', 'Gummy', 'No preference']}
          value={data.format_pref ?? []}
          onChange={v => set('format_pref', v)}
          multi
        />
      </Field>

      <Field label="Known deficiencies from blood tests">
        <Chips
          options={deficiencyOptions}
          value={data.deficiencies_list ?? []}
          onChange={v => set('deficiencies_list', v)}
          multi
        />
      </Field>

      <Field label="Supplements you're considering but haven't started">
        <Chips
          options={consideringOptions}
          value={data.considering_list ?? []}
          onChange={v => set('considering_list', v)}
          multi
        />
      </Field>

      <Field label="Any prescription medications?">
        <Chips
          options={medOptions}
          value={data.medications_list ?? []}
          onChange={v => set('medications_list', v)}
          multi
        />
        <div style={{ marginTop: '12px' }}>
          <textarea
            value={data.medications_other ?? ''}
            onChange={e => set('medications_other', e.target.value)}
            placeholder="Any other medications?"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>
      </Field>
    </>
  )
}

interface SleepRoutineResult {
  target_sleep_hours: number
  target_bedtime: string
  presleep_routine: string[]
  environment_tips: string[]
  recovery_priority: string[]
  explanation: string
}

function SleepStep({ data, set, lifestyleData, physicalData, mentalData, trainingData, whoopData }: {
  data: StepData; set: StepSetter; lifestyleData?: StepData; physicalData?: StepData; mentalData?: StepData; trainingData?: StepData; whoopData?: WhoopContext | null
}) {
  const [routineCard, setRoutineCard] = useState<SleepRoutineResult | null>(null)
  const [routineLoading, setRoutineLoading] = useState(false)
  const [routineApplied, setRoutineApplied] = useState(false)

  // Auto-suggest avg sleep hours from bedtime + wake times (if still at default 7)
  useEffect(() => {
    const bedtime = lifestyleData?.sleep_target_weeknight
    const wakeTimes = lifestyleData?.wake_times
    if (bedtime && wakeTimes && (data.avg_sleep_hours === undefined || data.avg_sleep_hours === 7)) {
      const times: string[] = Object.values(wakeTimes as Record<string, string>)
      if (times.length > 0) {
        const wake = avgTimeStr(times)
        const hrs = timeDiffHours(bedtime as string, wake)
        const clamped = Math.round(Math.min(12, Math.max(3, hrs)))
        if (clamped !== 7) set('avg_sleep_hours', clamped)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifestyleData?.sleep_target_weeknight, lifestyleData?.wake_times])

  const wakeTimes = lifestyleData?.wake_times as Record<string, string> | undefined
  const wakeTime = wakeTimes ? avgTimeStr(Object.values(wakeTimes)) : undefined
  const hasContext = (data.sleep_issues as string[] | undefined)?.length || (data.quality_rating !== undefined) || whoopData?.avgSleepHours

  async function getSleepRoutine() {
    setRoutineLoading(true)
    setRoutineCard(null)
    try {
      const res = await fetch('/api/ai/sleep-routine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sleep_issues: data.sleep_issues ?? [],
          quality_rating: data.quality_rating ?? 6,
          avg_sleep_hours: data.avg_sleep_hours ?? 7,
          work_stress: mentalData?.work_stress ?? 5,
          stress_impact: mentalData?.stress_impact ?? [],
          primary_goal: physicalData?.primary_goal ?? 'General Health',
          sleep_target_weeknight: lifestyleData?.sleep_target_weeknight,
          wake_time: wakeTime,
          training_days: trainingData?.training_days ?? [],
          env_dark: data.env_dark,
          env_cool: data.env_cool,
          whoop_avg_sleep_hours: whoopData?.avgSleepHours ?? null,
          whoop_avg_sleep_performance: whoopData?.avgSleepPerformance ?? null,
          whoop_avg_recovery_score: whoopData?.avgRecoveryScore ?? null,
        }),
      })
      const d = await res.json() as SleepRoutineResult & { error?: string }
      if (!d.error) setRoutineCard(d)
    } finally {
      setRoutineLoading(false)
    }
  }

  function applyRoutine() {
    if (!routineCard) return
    if (routineCard.target_sleep_hours) set('avg_sleep_hours', routineCard.target_sleep_hours)
    // Pre-select pre-sleep routine items that match the AI suggestions
    const presleepOptions = ['Phone off 1hr before bed', 'Read a book', 'Stretch / yoga', 'Shower / bath', 'Meditation / breathwork', 'Journaling', 'Dim lights', 'No screens', 'Supplements', 'Light snack / protein', 'Nothing specific']
    const matched = routineCard.presleep_routine
      .map(step => presleepOptions.find(o => step.toLowerCase().includes(o.toLowerCase().split(' ')[0])))
      .filter((o): o is string => !!o)
    if (matched.length > 0) set('presleep_routine_list', [...new Set([...(data.presleep_routine_list as string[] ?? []), ...matched])])
    setRoutineApplied(true)
    setRoutineCard(null)
  }

  const sleepSupplementOptions = [
    'Magnesium glycinate', 'Magnesium threonate', 'Melatonin', 'L-theanine', 'Ashwagandha',
    'CBD oil', 'Valerian root', 'Tart cherry juice', 'Sleep mask', 'White noise machine',
    'Ear plugs', 'Weighted blanket', 'Blue light glasses', 'Red light panel', 'None',
  ]

  const presleepOptions = [
    'Phone off 1hr before bed', 'Read a book', 'Stretch / yoga', 'Shower / bath',
    'Meditation / breathwork', 'Journaling', 'Dim lights', 'No screens', 'Supplements',
    'Light snack / protein', 'Nothing specific',
  ]

  return (
    <>
      {whoopData?.avgSleepHours && (
        <div style={{
          backgroundColor: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '12px',
          padding: '12px 14px', marginBottom: '20px', fontSize: '12px', color: '#71717a', lineHeight: 1.5,
        }}>
          <span style={{ color: '#6366f1', fontWeight: 600 }}>WHOOP data: </span>
          {whoopData.avgSleepHours.toFixed(1)}h avg sleep
          {whoopData.avgSleepPerformance ? `, ${Math.round(whoopData.avgSleepPerformance)}% sleep performance` : ''}
          {whoopData.avgRecoveryScore ? `, ${Math.round(whoopData.avgRecoveryScore)}% avg recovery` : ''}
          {' '}— used to personalise your sleep protocol.
        </div>
      )}

      <Field label="Average hours of sleep per night">
        <Stepper value={data.avg_sleep_hours ?? 7} onChange={v => set('avg_sleep_hours', v)} min={3} max={12} suffix=" hrs" />
      </Field>
      <Field label="Sleep quality — how would you rate it?" hint="1 = terrible, 10 = perfect">
        <RangeSlider value={data.quality_rating ?? 6} onChange={v => set('quality_rating', v)} min={1} max={10} />
      </Field>
      <Field label="Sleep issues">
        <Chips
          options={['Hard to fall asleep', 'Wake up during night', 'Wake unrefreshed', 'Early waking', 'Vivid dreams', 'None']}
          value={data.sleep_issues ?? []}
          onChange={v => set('sleep_issues', v)}
          multi
        />
      </Field>

      {/* AI sleep protocol card */}
      <div style={{ marginBottom: '24px' }}>
        {!routineCard && !routineApplied && (
          <button
            onClick={getSleepRoutine}
            disabled={routineLoading}
            style={{
              width: '100%', backgroundColor: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.25)', borderRadius: '12px',
              padding: '12px 16px', cursor: routineLoading ? 'not-allowed' : 'pointer',
              textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              opacity: routineLoading ? 0.7 : 1,
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#818cf8' }}>
                {routineLoading ? 'Generating protocol…' : '✦ Build my sleep protocol'}
              </div>
              <div style={{ fontSize: '11px', color: '#52525b', marginTop: '2px' }}>
                Personalised routine based on your issues, stress{whoopData?.avgSleepHours ? ' + WHOOP sleep data' : ''} and goal
              </div>
            </div>
            {!routineLoading && <ChevronRight size={16} color="#818cf8" />}
          </button>
        )}
        {routineApplied && (
          <div style={{
            backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <Check size={14} color="#818cf8" />
            <span style={{ fontSize: '13px', color: '#818cf8', fontWeight: 600 }}>Sleep protocol applied</span>
          </div>
        )}
        {routineCard && (
          <div style={{
            backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '14px', padding: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#818cf8', marginBottom: '12px' }}>Your sleep protocol</div>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', color: '#52525b', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target</div>
              <div style={{ fontSize: '14px', color: '#fff' }}>
                {routineCard.target_sleep_hours}h sleep · Bedtime {routineCard.target_bedtime}
              </div>
            </div>
            {routineCard.presleep_routine.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: '#52525b', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pre-sleep routine</div>
                {routineCard.presleep_routine.map((step, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#a1a1aa', padding: '4px 0', borderBottom: '1px solid #1a1a1a' }}>
                    {i + 1}. {step}
                  </div>
                ))}
              </div>
            )}
            {routineCard.environment_tips.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: '#52525b', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Environment</div>
                {routineCard.environment_tips.map((tip, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#a1a1aa', padding: '3px 0' }}>· {tip}</div>
                ))}
              </div>
            )}
            <p style={{ fontSize: '12px', color: '#71717a', lineHeight: 1.6, marginBottom: '12px' }}>{routineCard.explanation}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={applyRoutine} style={{
                flex: 2, padding: '10px', borderRadius: '10px', border: 'none',
                backgroundColor: '#6366f1', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
              }}>Apply protocol</button>
              <button onClick={() => setRoutineCard(null)} style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                backgroundColor: 'transparent', border: '1px solid #27272a',
                color: '#52525b', fontSize: '13px', cursor: 'pointer',
              }}>Skip</button>
            </div>
          </div>
        )}
      </div>

      <Field label="What does your pre-sleep routine look like?">
        <Chips
          options={presleepOptions}
          value={data.presleep_routine_list ?? []}
          onChange={v => set('presleep_routine_list', v)}
          multi
        />
        <div style={{ marginTop: '12px' }}>
          <textarea
            value={data.presleep_notes ?? ''}
            onChange={e => set('presleep_notes', e.target.value)}
            placeholder="Any other notes?"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>
      </Field>

      <Field label="Is your sleep environment dark?">
        <Toggle value={data.env_dark ?? true} onChange={v => set('env_dark', v)} />
      </Field>
      <Field label="Is your room cool at night?">
        <Toggle value={data.env_cool ?? true} onChange={v => set('env_cool', v)} />
      </Field>

      <Field label="Sleep supplements or tools you use">
        <Chips
          options={sleepSupplementOptions}
          value={data.sleep_supplements_list ?? []}
          onChange={v => set('sleep_supplements_list', v)}
          multi
        />
      </Field>

      <Field label="Sleep tracking device">
        <Chips
          options={['WHOOP', 'Apple Watch', 'Oura Ring', 'Garmin', 'Fitbit', 'None']}
          value={data.tracking_device ?? ''}
          onChange={v => set('tracking_device', v)}
        />
      </Field>
      <Field label="Recovery methods after training">
        <Chips
          options={['Cold shower', 'Ice bath', 'Sauna', 'Massage', 'Stretching', 'Foam rolling', 'Nothing specific']}
          value={data.recovery_methods ?? []}
          onChange={v => set('recovery_methods', v)}
          multi
        />
      </Field>
    </>
  )
}

function SkincareStep({ data, set }: { data: StepData; set: StepSetter }) {
  return (
    <>
      <Field label="Skin type">
        <Chips
          options={['Oily', 'Dry', 'Combination', 'Sensitive', 'Normal', 'Acne-prone']}
          value={data.skin_type ?? ''}
          onChange={v => set('skin_type', v)}
        />
      </Field>
      <Field label="Top skin concerns" hint="Select up to 3">
        <Chips
          options={['Acne / breakouts', 'Dark spots / hyperpigmentation', 'Anti-aging / fine lines', 'Dullness', 'Uneven texture', 'Redness', 'Pores', 'Dark circles', 'Oiliness']}
          value={data.skin_concerns ?? []}
          onChange={v => set('skin_concerns', v)}
          multi
        />
      </Field>
      <Field label="Morning routine" hint="Products in order">
        <textarea
          value={data.routine_morning ?? ''}
          onChange={e => set('routine_morning', e.target.value)}
          placeholder="E.g. gentle cleanser → niacinamide → SPF 50"
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </Field>
      <Field label="Evening routine" hint="Products in order">
        <textarea
          value={data.routine_evening ?? ''}
          onChange={e => set('routine_evening', e.target.value)}
          placeholder="E.g. cleansing oil → cleanser → retinol → moisturiser"
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </Field>
      <Field label="SPF factor you currently use">
        <Chips
          options={['SPF 15', 'SPF 30', 'SPF 50', 'SPF 50+', "I don't use SPF"]}
          value={data.spf ?? ''}
          onChange={v => set('spf', v)}
        />
      </Field>
      <Field label="Active ingredients you use">
        <Chips
          options={['Retinol / Retinoid', 'AHA / BHA', 'Vitamin C', 'Niacinamide', 'Hyaluronic acid', 'Peptides', 'Azelaic acid', 'None']}
          value={data.actives ?? []}
          onChange={v => set('actives', v)}
          multi
        />
      </Field>
      <Field label="Any adverse reactions to skincare?">
        <input
          type="text"
          value={data.adverse_reactions ?? ''}
          onChange={e => set('adverse_reactions', e.target.value)}
          placeholder="E.g. retinol causes peeling, fragrance causes breakouts"
          style={inputStyle}
        />
      </Field>
      <Field label="Time willing to spend on skincare per day">
        <Chips
          options={['< 2 min', '2–5 min', '5–10 min', '10–20 min', '20+ min']}
          value={data.time_willingness ?? ''}
          onChange={v => set('time_willingness', v)}
        />
      </Field>
      <Field label="Monthly skincare budget">
        <Chips
          options={['< $30', '$30–$75', '$75–$150', '$150–$300', '$300+']}
          value={data.budget ?? ''}
          onChange={v => set('budget', v)}
        />
      </Field>
    </>
  )
}

function HairStep({ data, set }: { data: StepData; set: StepSetter }) {
  return (
    <>
      <Field label="Hair type">
        <Chips
          options={['Straight', 'Wavy', 'Curly', 'Coily', 'Fine', 'Thick', 'Medium']}
          value={data.hair_type ?? []}
          onChange={v => set('hair_type', v)}
          multi
        />
      </Field>
      <Field label="Main hair concerns">
        <Chips
          options={['Frizz', 'Dryness', 'Oiliness', 'Damage / breakage', 'Lack of volume', 'Colour fading', 'Slow growth', 'Thinning']}
          value={data.hair_concerns ?? []}
          onChange={v => set('hair_concerns', v)}
          multi
        />
      </Field>
      <Field label="How often do you wash your hair?">
        <Chips
          options={['Daily', 'Every 2 days', 'Every 3 days', '2x per week', 'Weekly']}
          value={data.wash_frequency ?? ''}
          onChange={v => set('wash_frequency', v)}
        />
      </Field>
      <Field label="Current products">
        <textarea
          value={data.current_products ?? ''}
          onChange={e => set('current_products', e.target.value)}
          placeholder="E.g. Olaplex shampoo, kerastase mask, argan oil"
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </Field>
      <Field label="Scalp issues">
        <Chips
          options={['Dandruff', 'Flaking', 'Oiliness', 'Sensitivity', 'Itching', 'None']}
          value={data.scalp_issues ?? []}
          onChange={v => set('scalp_issues', v)}
          multi
        />
      </Field>
      <Field label="Concerned about hair thinning or loss?">
        <Toggle value={data.thinning_concern ?? false} onChange={v => set('thinning_concern', v)} />
      </Field>
      <Field label="Weekly time for hair care">
        <Chips
          options={['< 15 min', '15–30 min', '30–60 min', '1–2 hrs', '2+ hrs']}
          value={data.time_weekly ?? ''}
          onChange={v => set('time_weekly', v)}
        />
      </Field>
      <Field label="Monthly hair budget">
        <Chips
          options={['< $20', '$20–$50', '$50–$100', '$100–$200', '$200+']}
          value={data.budget ?? ''}
          onChange={v => set('budget', v)}
        />
      </Field>
    </>
  )
}

function MentalStep({ data, set, physicalData }: { data: StepData; set: StepSetter; physicalData?: StepData }) {
  const goal = physicalData?.primary_goal as string | undefined
  const stress = data.work_stress as number | undefined
  const showCortisolWarning = !!stress && stress >= 7 && (goal === 'Fat Loss' || goal === 'Recomposition')
  const showRecoveryWarning = !!stress && stress >= 7 && (goal === 'Performance' || goal === 'Muscle Gain')

  return (
    <>
      <Field label="Current work stress level" hint="1 = very relaxed, 10 = extremely stressed">
        <RangeSlider value={data.work_stress ?? 5} onChange={v => set('work_stress', v)} min={1} max={10} />
      </Field>
      <Field label="What drives your stress?">
        <input
          type="text"
          value={data.stress_drivers ?? ''}
          onChange={e => set('stress_drivers', e.target.value)}
          placeholder="E.g. workload, deadlines, relationships, finances"
          style={inputStyle}
        />
      </Field>
      <Field label="How does stress affect you?" hint="Select all that apply">
        <Chips
          options={['Kills appetite', 'Increases cravings', 'Disrupts sleep', 'Reduces training motivation', 'Affects mood', 'Causes anxiety', 'Little effect']}
          value={data.stress_impact ?? []}
          onChange={v => set('stress_impact', v)}
          multi
        />
      </Field>
      <Field label="Do you meditate or do breathwork?">
        <Toggle value={data.meditates ?? false} onChange={v => set('meditates', v)} />
      </Field>
      {data.meditates && (
        <Field label="How often?">
          <Chips
            options={['Daily', 'Most days', 'A few times a week', 'Occasionally']}
            value={data.meditation_frequency ?? ''}
            onChange={v => set('meditation_frequency', v)}
          />
        </Field>
      )}
      {showCortisolWarning && (
        <div style={{
          backgroundColor: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: '12px', padding: '12px 14px', marginBottom: '8px',
          fontSize: '13px', color: '#fda4af', lineHeight: 1.6,
        }}>
          <strong style={{ color: '#fb7185' }}>High stress can stall {goal === 'Fat Loss' ? 'fat loss' : 'body recomposition'}.</strong>
          {' '}Elevated cortisol promotes fat storage and muscle breakdown. Your sleep and recovery sections will include personalised strategies to manage this.
        </div>
      )}
      {showRecoveryWarning && (
        <div style={{
          backgroundColor: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: '12px', padding: '12px 14px', marginBottom: '8px',
          fontSize: '13px', color: '#fda4af', lineHeight: 1.6,
        }}>
          <strong style={{ color: '#fb7185' }}>High stress limits training adaptations.</strong>
          {' '}Chronic stress suppresses recovery hormones and increases injury risk. Prioritising sleep and stress management will compound your {goal?.toLowerCase()} results.
        </div>
      )}
      <Field label="Overall life satisfaction" hint="1 = struggling, 10 = thriving">
        <RangeSlider value={data.life_satisfaction ?? 6} onChange={v => set('life_satisfaction', v)} min={1} max={10} />
      </Field>
    </>
  )
}

function TravelStep({ data, set }: { data: StepData; set: StepSetter }) {
  return (
    <>
      <Field label="How often do you travel?">
        <Chips
          options={['Rarely', '1–2x per month', 'Weekly', 'Constantly']}
          value={data.travel_frequency ?? ''}
          onChange={v => set('travel_frequency', v)}
        />
      </Field>
      <Field label="Type of travel">
        <Chips
          options={['Work trips', 'Holidays', 'Festivals / events', 'Weekend getaways', 'Long-haul']}
          value={data.travel_type ?? []}
          onChange={v => set('travel_type', v)}
          multi
        />
      </Field>
      <Field label="How do you maintain your routine while travelling?">
        <textarea
          value={data.travel_routine ?? ''}
          onChange={e => set('travel_routine', e.target.value)}
          placeholder="E.g. hotel gym, pack supplements, stick to protein-first"
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </Field>
      <Field label="Go-to eating strategy when travelling or eating out">
        <textarea
          value={data.travel_eating ?? ''}
          onChange={e => set('travel_eating', e.target.value)}
          placeholder="E.g. protein + salad, skip breakfast, intermittent fasting"
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </Field>
      <Field label="Upcoming events or trips motivating your goals">
        <input
          type="text"
          value={data.upcoming_events ?? ''}
          onChange={e => set('upcoming_events', e.target.value)}
          placeholder="E.g. Tomorrowland July, Maldives holiday, wedding"
          style={inputStyle}
        />
      </Field>
      <Field label="How much does your appearance matter to you socially?" hint="1 = not at all, 10 = extremely">
        <RangeSlider value={data.appearance_priority ?? 7} onChange={v => set('appearance_priority', v)} min={1} max={10} />
      </Field>
    </>
  )
}

function TechStep({ data, set, mentalData }: { data: StepData; set: StepSetter; mentalData?: StepData }) {
  // Auto-suggest biometrics based on owned wearables
  useEffect(() => {
    const wearableMetrics: Record<string, string[]> = {
      'WHOOP':        ['HRV', 'RHR', 'Sleep stages'],
      'Apple Watch':  ['Steps', 'RHR', 'SPO2'],
      'Oura Ring':    ['HRV', 'Sleep stages', 'RHR'],
      'Garmin':       ['Steps', 'RHR', 'Sleep stages', 'SPO2'],
      'Fitbit':       ['Steps', 'RHR', 'Sleep stages'],
      'Smart scale':  ['Body weight', 'Body composition'],
      'CGM':          ['Blood glucose'],
    }
    const wearables: string[] = data.wearables ?? []
    const current: string[] = data.tracked_biometrics ?? []
    const toAdd = wearables
      .flatMap(w => wearableMetrics[w] ?? [])
      .filter(m => !current.includes(m))
    const unique = [...new Set(toAdd)]
    if (unique.length > 0) {
      set('tracked_biometrics', [...current, ...unique])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.wearables])

  const meditates = mentalData?.meditates
  const apps: string[] = data.apps ?? []
  const showMeditationHint = meditates && !apps.includes('Calm') && !apps.includes('Headspace')

  return (
    <>
      <Field label="Wearables you own">
        <Chips
          options={['WHOOP', 'Apple Watch', 'Oura Ring', 'Garmin', 'Fitbit', 'Smart scale', 'CGM', 'None']}
          value={data.wearables ?? []}
          onChange={v => set('wearables', v)}
          multi
        />
      </Field>
      <Field label="Health & fitness apps you use">
        <Chips
          options={['MyFitnessPal', 'Cronometer', 'Strong', 'Hevy', 'Strava', 'Nike Run Club', 'Calm', 'Headspace', 'Apple Health', 'WHOOP']}
          value={data.apps ?? []}
          onChange={v => set('apps', v)}
          multi
        />
        {showMeditationHint && (
          <div style={{ marginTop: '10px', backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: '10px', padding: '10px 12px' }}>
            <div style={{ fontSize: '12px', color: '#818cf8', marginBottom: '8px' }}>You meditate — want to add a meditation app?</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['Calm', 'Headspace'].filter(a => !apps.includes(a)).map(a => (
                <button key={a} onClick={() => set('apps', [...apps, a])} style={{ padding: '6px 14px', borderRadius: '100px', border: '1.5px solid rgba(99,102,241,0.4)', backgroundColor: 'rgba(99,102,241,0.1)', color: '#818cf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  + {a}
                </button>
              ))}
            </div>
          </div>
        )}
      </Field>
      <Field label="Open to investing in health tech?">
        <Chips
          options={['No budget', 'Small ($50–$200)', 'Moderate ($200–$500)', 'High ($500+)', 'Already well-equipped']}
          value={data.tech_budget ?? ''}
          onChange={v => set('tech_budget', v)}
        />
      </Field>
      <Field label="Biometrics you currently track">
        <Chips
          options={['HRV', 'RHR', 'Steps', 'Sleep stages', 'Body weight', 'Body composition', 'Blood glucose', 'SPO2']}
          value={data.tracked_biometrics ?? []}
          onChange={v => set('tracked_biometrics', v)}
          multi
        />
      </Field>
      <Field label="Gadgets or devices you're curious about">
        <input
          type="text"
          value={data.curious_devices ?? ''}
          onChange={e => set('curious_devices', e.target.value)}
          placeholder="E.g. Oura Ring, CGM, smart scale, red light therapy"
          style={inputStyle}
        />
      </Field>
    </>
  )
}

function CoachingStep({ data, set }: { data: StepData; set: StepSetter }) {
  const planPref = data.plan_setup_preference ?? ''

  return (
    <>
      <Field label="How would you like to set up your plans?" hint="Choose your preferred approach">
        <Chips
          options={[
            "I want full control — I'll set my own plans",
            "I want AI guidance on structure, I'll fill in details",
            "Let the AI build everything for me — I need guidance",
          ]}
          value={planPref}
          onChange={v => set('plan_setup_preference', v)}
        />
        {planPref === "Let the AI build everything for me — I need guidance" && (
          <div style={{
            marginTop: '14px', backgroundColor: 'rgba(249,115,22,0.08)',
            border: '1px solid rgba(249,115,22,0.25)', borderRadius: '12px', padding: '14px',
          }}>
            <div style={{ fontSize: '13px', color: '#f97316', lineHeight: 1.6 }}>
              Your AI coach will generate a personalised training plan, nutrition targets, and supplement protocol based on your profile. You can adjust at any time.
            </div>
          </div>
        )}
      </Field>

      <Field label="Do you currently work with a PT or coach?">
        <Toggle value={data.has_coach ?? false} onChange={v => set('has_coach', v)} />
      </Field>
      <Field label="Preferred coaching style">
        <Chips
          options={['Data-driven', 'Motivational', 'Conversational', 'Direct & blunt', 'Educational']}
          value={data.coaching_style ?? ''}
          onChange={v => set('coaching_style', v)}
        />
      </Field>
      <Field label="How blunt do you want feedback?" hint="1 = gentle, 5 = brutal honesty">
        <RangeSlider value={data.feedback_bluntness ?? 3} onChange={v => set('feedback_bluntness', v)} min={1} max={5} />
      </Field>
      <Field label="What has derailed your routine most in the past?">
        <Chips
          options={['Work stress', 'Travel', 'Social life', 'Injury', 'Boredom / plateaus', 'Motivation dips', 'Bad nutrition habits', 'Lack of accountability']}
          value={data.past_derailers ?? []}
          onChange={v => set('past_derailers', v)}
          multi
        />
      </Field>
      <Field label="Have you hit your goals before and then fallen off?">
        <Toggle value={data.has_failed_before ?? false} onChange={v => set('has_failed_before', v)} />
      </Field>
      {data.has_failed_before && (
        <Field label="What happened?">
          <textarea
            value={data.failure_reason ?? ''}
            onChange={e => set('failure_reason', e.target.value)}
            placeholder="Be honest — the AI coach uses this to pre-empt the same pattern"
            rows={2}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </Field>
      )}
      <Field label="Anything else the AI coach should know about you?">
        <textarea
          value={data.additional_context ?? ''}
          onChange={e => set('additional_context', e.target.value)}
          placeholder="Open field — any context that would help personalise your experience"
          rows={3}
          style={{ ...inputStyle, resize: 'none' }}
        />
      </Field>
    </>
  )
}

// ─── Interests step ────────────────────────────────────────────────────────────

const COMPULSORY_INTEREST_OPTIONS = [
  { id: 'physical',  label: 'Physical Profile',     icon: User,            color: '#f97316' },
  { id: 'training',  label: 'Training & Gym',       icon: Dumbbell,        color: '#3b82f6' },
  { id: 'nutrition', label: 'Nutrition & Diet',     icon: UtensilsCrossed, color: '#10b981' },
  { id: 'coaching',  label: 'Coaching Preferences', icon: Target,          color: '#f97316' },
]

const OPTIONAL_INTEREST_OPTIONS = [
  { id: 'lifestyle',   label: 'Lifestyle & Schedule', icon: Calendar, color: '#8b5cf6' },
  { id: 'supplements', label: 'Supplements',          icon: Pill,     color: '#f59e0b' },
  { id: 'sleep',       label: 'Sleep & Recovery',     icon: Moon,     color: '#6366f1' },
  { id: 'skincare',    label: 'Skincare',             icon: Sparkles, color: '#ec4899' },
  { id: 'hair',        label: 'Hair',                 icon: Wind,     color: '#14b8a6' },
  { id: 'mental',      label: 'Mental & Stress',      icon: Brain,    color: '#f43f5e' },
  { id: 'travel',      label: 'Travel & Social',      icon: Plane,    color: '#06b6d4' },
  { id: 'tech',        label: 'Tech & Wearables',     icon: Cpu,      color: '#84cc16' },
]

const GOAL_RECOMMENDATIONS: Record<string, string[]> = {
  'Fat Loss':       ['lifestyle', 'mental', 'sleep'],
  'Muscle Gain':    ['supplements', 'sleep', 'tech'],
  'Recomposition':  ['lifestyle', 'supplements', 'sleep', 'mental'],
  'Performance':    ['sleep', 'mental', 'tech', 'lifestyle'],
  'General Health': ['lifestyle', 'mental', 'sleep'],
}

function InterestsStep({ data, set, physicalData }: { data: StepData; set: StepSetter; physicalData?: StepData }) {
  const selected: string[] = (data.focused_sections as string[]) ?? []
  const goal = physicalData?.primary_goal as string | undefined
  const recommended = goal ? (GOAL_RECOMMENDATIONS[goal] ?? []) : []

  // Auto-select recommended sections that haven't been touched yet
  useEffect(() => {
    if (!goal || selected.length > 0) return
    set('focused_sections', recommended)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal])

  function toggle(id: string) {
    set('focused_sections', selected.includes(id)
      ? selected.filter(x => x !== id)
      : [...selected, id])
  }

  return (
    <>
      {goal && recommended.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)',
          borderRadius: '12px', padding: '12px 14px', marginBottom: '20px',
          fontSize: '13px', color: '#a1a1aa', lineHeight: 1.5,
        }}>
          <span style={{ color: '#f97316', fontWeight: 600 }}>Based on your {goal} goal</span>
          {' '}— we&apos;ve pre-selected the most relevant sections. You can adjust below.
        </div>
      )}

      {/* Compulsory — locked */}
      <p style={{ fontSize: '11px', color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Always included
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
        {COMPULSORY_INTEREST_OPTIONS.map(({ id, label, icon: Icon, color }) => (
          <div key={id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 12px', borderRadius: '12px',
            border: '1.5px solid #1c1c1c', backgroundColor: '#0a0a0a', opacity: 0.55,
          }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
              backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={13} color={color} />
            </div>
            <span style={{ fontSize: '11px', color: '#71717a', lineHeight: 1.3 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Optional — selectable */}
      <p style={{ fontSize: '11px', color: '#52525b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Optional — select what applies to you
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {OPTIONAL_INTEREST_OPTIONS.map(({ id, label, icon: Icon, color }) => {
          const active = selected.includes(id)
          const isRecommended = recommended.includes(id)
          return (
            <button key={id} onClick={() => toggle(id)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              gap: '10px', padding: '14px', borderRadius: '14px', cursor: 'pointer',
              border: active ? `1.5px solid ${color}` : '1.5px solid #27272a',
              backgroundColor: active ? `${color}12` : '#0a0a0a',
              transition: 'all 0.15s ease', textAlign: 'left', position: 'relative',
            }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={15} color={color} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: active ? 600 : 400, color: active ? '#fff' : '#a1a1aa', lineHeight: 1.3 }}>
                {label}
              </span>
              {isRecommended && !active && (
                <div style={{
                  position: 'absolute', top: '8px', right: '8px',
                  backgroundColor: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)',
                  borderRadius: '6px', padding: '2px 6px',
                  fontSize: '9px', fontWeight: 700, color: '#f97316', letterSpacing: '0.3px',
                }}>
                  REC
                </div>
              )}
              {active && (
                <div style={{
                  position: 'absolute', top: '10px', right: '10px',
                  width: '16px', height: '16px', borderRadius: '50%',
                  backgroundColor: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={10} color="#000" strokeWidth={3} />
                </div>
              )}
            </button>
          )
        })}
      </div>

      <p style={{ fontSize: '12px', color: '#3f3f46', lineHeight: 1.6, textAlign: 'center' }}>
        Skipped sections can be turned on anytime in <span style={{ color: '#52525b' }}>Settings → Profile</span>.
      </p>
    </>
  )
}

// ─── Step renderer ─────────────────────────────────────────────────────────────

interface WhoopContext {
  avgKilojoules: number | null
  avgSleepHours: number | null
  avgSleepPerformance: number | null
  avgRecoveryScore: number | null
}

function StepContent({ stepId, data, set, sectionData, whoopData }: {
  stepId: StepId
  data: StepData
  set: StepSetter
  sectionData: Record<string, StepData>
  whoopData: WhoopContext | null
}) {
  switch (stepId) {
    case 'interests':   return <InterestsStep data={data} set={set} physicalData={sectionData.physical} />
    case 'physical':    return <PhysicalStep data={data} set={set} trainingData={sectionData.training_ext} />
    case 'lifestyle':   return <LifestyleStep data={data} set={set} />
    case 'training':    return <TrainingStep data={data} set={set} physicalData={sectionData.physical} lifestyleData={sectionData.lifestyle_ext} />
    case 'nutrition':   return <NutritionStep data={data} set={set} lifestyleData={sectionData.lifestyle_ext} physicalData={sectionData.physical} trainingData={sectionData.training_ext} whoopData={whoopData} />
    case 'mental':      return <MentalStep data={data} set={set} physicalData={sectionData.physical} />
    case 'sleep':       return <SleepStep data={data} set={set} lifestyleData={sectionData.lifestyle_ext} physicalData={sectionData.physical} mentalData={sectionData.mental} trainingData={sectionData.training_ext} whoopData={whoopData} />
    case 'supplements': return <SupplementsStep data={data} set={set} physicalData={sectionData.physical} nutritionData={sectionData.nutrition_ext} sleepData={sectionData.sleep_ext} mentalData={sectionData.mental} trainingData={sectionData.training_ext} />
    case 'skincare':    return <SkincareStep data={data} set={set} />
    case 'hair':        return <HairStep data={data} set={set} />
    case 'travel':      return <TravelStep data={data} set={set} />
    case 'tech':        return <TechStep data={data} set={set} mentalData={sectionData.mental} />
    case 'coaching':    return <CoachingStep data={data} set={set} />
    default:            return null
  }
}

// ─── Done screen ───────────────────────────────────────────────────────────────

interface DoneScreenProps {
  sectionData: Record<string, StepData | undefined>
  aiMacros: MacroResult | null
  aiMacrosLoading: boolean
  macrosAccepted: boolean
  onAccept: () => void
  onDecline: () => void
}

function DoneScreen({ sectionData, aiMacros, aiMacrosLoading, macrosAccepted, onAccept, onDecline }: DoneScreenProps) {
  function handleDownload() {
    const summary = generateSummary(sectionData)
    const blob = new Blob([summary], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'apex-profile-summary.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start', padding: '48px 24px 140px', textAlign: 'center',
    }}>
      <div style={{
        width: '80px', height: '80px', borderRadius: '24px',
        backgroundColor: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
      }}>
        <Check size={36} color="#22c55e" />
      </div>
      <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '10px' }}>
        You&apos;re all set
      </h1>
      <p style={{ fontSize: '15px', color: '#71717a', lineHeight: 1.7, marginBottom: '8px', maxWidth: '300px' }}>
        Your profile is saved. Your AI coach now has full context to personalise everything.
      </p>
      <p style={{ fontSize: '13px', color: '#3f3f46', marginBottom: '32px' }}>
        You can update any section anytime from Settings.
      </p>

      {/* AI macro calculation */}
      <div style={{ width: '100%', maxWidth: '380px', textAlign: 'left', marginBottom: '24px' }}>
        <div style={{
          backgroundColor: '#0d0d0d', border: '1px solid #1e1e1e',
          borderRadius: '16px', padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              backgroundColor: 'rgba(249,115,22,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Flame size={14} color="#f97316" />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>Daily macro targets</span>
          </div>

          {aiMacrosLoading && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '13px', color: '#52525b' }}>Calculating based on your goals…</div>
            </div>
          )}

          {!aiMacrosLoading && !aiMacros && (
            <div style={{ fontSize: '13px', color: '#52525b', lineHeight: 1.5 }}>
              Couldn&apos;t calculate — make sure your age, height, weight and target weight are filled in. You can set these manually in Settings.
            </div>
          )}

          {!aiMacrosLoading && aiMacros && !macrosAccepted && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                {[
                  { label: 'Calories', value: String(aiMacros.calories) },
                  { label: 'Protein', value: `${aiMacros.protein_g}g` },
                  { label: 'Carbs', value: `${aiMacros.carbs_g}g` },
                  { label: 'Fats', value: `${aiMacros.fats_g}g` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ backgroundColor: '#181818', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', color: '#52525b', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>{value}</div>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: '#71717a', lineHeight: 1.6, marginBottom: '14px' }}>
                {aiMacros.explanation}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={onAccept}
                  style={{
                    flex: 2, padding: '11px', borderRadius: '10px',
                    backgroundColor: '#f97316', border: 'none',
                    color: '#000', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Apply these targets
                </button>
                <button
                  onClick={onDecline}
                  style={{
                    flex: 1, padding: '11px', borderRadius: '10px',
                    backgroundColor: 'transparent', border: '1px solid #27272a',
                    color: '#52525b', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  Skip
                </button>
              </div>
            </>
          )}

          {!aiMacrosLoading && aiMacros && macrosAccepted && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Check size={16} color="#22c55e" />
              <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>
                Targets will be saved when you go to dashboard
              </span>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={handleDownload}
        style={{
          padding: '12px 24px', borderRadius: '12px',
          backgroundColor: 'transparent', border: '1.5px solid #27272a',
          color: '#71717a', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}
      >
        Download my profile summary
      </button>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface MacroResult {
  calories: number
  protein_g: number
  carbs_g: number
  fats_g: number
  explanation: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [animKey, setAnimKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showSectionNav, setShowSectionNav] = useState(false)
  const [aiMacros, setAiMacros] = useState<MacroResult | null>(null)
  const [aiMacrosLoading, setAiMacrosLoading] = useState(false)
  const [macrosAccepted, setMacrosAccepted] = useState(false)
  const [whoopData, setWhoopData] = useState<WhoopContext | null>(null)
  const [sectionData, setSectionData] = useState<Record<string, StepData>>({
    interests: {}, physical: {}, lifestyle_ext: {}, training_ext: {}, nutrition_ext: {},
    supplements_ext: {}, sleep_ext: {}, skincare: {}, hair: {},
    mental: {}, travel: {}, tech_prefs: {}, coaching: {},
  })

  const step = STEPS[stepIndex]
  const isWelcome = step.id === 'welcome'
  const isDone = step.id === 'done'
  const focusedSections = (sectionData.interests?.focused_sections as string[]) ?? []
  const includedSteps = CONTENT_STEPS.filter(s => !OPTIONAL_STEP_IDS.has(s.id) || focusedSections.includes(s.id))
  const contentIndex = includedSteps.findIndex(s => s.id === step.id)
  const total = includedSteps.length

  // Load existing data
  useEffect(() => {
    const isEditMode = new URLSearchParams(window.location.search).get('edit') === 'true'
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(d => {
        if (d && Object.keys(d).length > 0) {
          setSectionData(prev => ({
            interests: d.interests ?? prev.interests,
            physical: d.physical ?? prev.physical,
            lifestyle_ext: d.lifestyle_ext ?? prev.lifestyle_ext,
            training_ext: d.training_ext ?? prev.training_ext,
            nutrition_ext: d.nutrition_ext ?? prev.nutrition_ext,
            supplements_ext: d.supplements_ext ?? prev.supplements_ext,
            sleep_ext: d.sleep_ext ?? prev.sleep_ext,
            skincare: d.skincare ?? prev.skincare,
            hair: d.hair ?? prev.hair,
            mental: d.mental ?? prev.mental,
            travel: d.travel ?? prev.travel,
            tech_prefs: d.tech_prefs ?? prev.tech_prefs,
            coaching: d.coaching ?? prev.coaching,
          }))
          if (d.completed && !isEditMode) {
            router.replace('/')
            return
          }
          if (d.current_step && d.current_step > 0) {
            setStepIndex(Math.min(d.current_step, STEPS.length - 1))
          }
        }
      })
      .catch(() => {})
  }, [router])

  // Fetch WHOOP context once on mount — used to enrich AI suggestions throughout
  useEffect(() => {
    fetch('/api/whoop/data')
      .then(r => r.json())
      .then((d: { cycles?: { kilojoule: number | null }[]; sleep?: { duration_hrs: number | null; sleep_performance_pct: number | null }[]; recovery?: { recovery_score: number | null }[] }) => {
        const cycles = d.cycles ?? []
        const sleep = d.sleep ?? []
        const recovery = d.recovery ?? []
        const kJCycles = cycles.filter(c => c.kilojoule !== null)
        const avgKilojoules = kJCycles.length > 0 ? kJCycles.reduce((s, c) => s + (c.kilojoule ?? 0), 0) / kJCycles.length : null
        const sleepWithHours = sleep.filter(s => s.duration_hrs !== null)
        const avgSleepHours = sleepWithHours.length > 0 ? sleepWithHours.reduce((s, sl) => s + (sl.duration_hrs ?? 0), 0) / sleepWithHours.length : null
        const sleepWithPerf = sleep.filter(s => s.sleep_performance_pct !== null)
        const avgSleepPerformance = sleepWithPerf.length > 0 ? sleepWithPerf.reduce((s, sl) => s + (sl.sleep_performance_pct ?? 0), 0) / sleepWithPerf.length : null
        const recoveryWithScore = recovery.filter(r => r.recovery_score !== null)
        const avgRecoveryScore = recoveryWithScore.length > 0 ? recoveryWithScore.reduce((s, r) => s + (r.recovery_score ?? 0), 0) / recoveryWithScore.length : null
        if (avgKilojoules !== null || avgSleepHours !== null) {
          setWhoopData({ avgKilojoules, avgSleepHours, avgSleepPerformance, avgRecoveryScore })
        }
      })
      .catch(() => {})
  }, [])

  // Trigger AI macro calculation when user reaches done screen
  useEffect(() => {
    if (!isDone || aiMacros || aiMacrosLoading) return
    setAiMacrosLoading(true)
    fetch('/api/ai/calculate-macros', { method: 'POST' })
      .then(r => r.json())
      .then((d: MacroResult & { error?: string }) => { if (!d.error) setAiMacros(d) })
      .catch(() => {})
      .finally(() => setAiMacrosLoading(false))
  }, [isDone, aiMacros, aiMacrosLoading])

  const currentSection = step.section
  const currentData = currentSection ? (sectionData[currentSection] ?? {}) : {}

  const setField = useCallback<StepSetter>((k, v) => {
    if (!currentSection) return
    setSectionData(prev => ({
      ...prev,
      [currentSection]: { ...prev[currentSection], [k]: v },
    }))
  }, [currentSection])

  async function saveCurrentStep() {
    if (!currentSection) return
    setSaving(true)
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: currentSection,
          data: currentData,
          current_step: stepIndex,
        }),
      })
    } catch {}
    setSaving(false)
  }

  function navigate(dir: 'forward' | 'back') {
    const focused = (sectionData.interests?.focused_sections as string[]) ?? []
    setDirection(dir)
    setAnimKey(k => k + 1)
    setStepIndex(i => getNextIndex(i, dir, focused))
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  async function handleNext() {
    if (!isWelcome && !isDone && currentSection) await saveCurrentStep()
    if (isDone) {
      setSaving(true)
      if (macrosAccepted && aiMacros) {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            table: 'user_goals',
            data: { daily_calorie_target: aiMacros.calories, daily_protein_target_g: aiMacros.protein_g },
          }),
        })
      }
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })
      setSaving(false)
      router.push('/')
      return
    }
    navigate('forward')
  }

  async function handleSkip() {
    if (currentSection) {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_step: stepIndex + 1 }),
      })
    }
    navigate('forward')
  }

  function handleBack() {
    navigate('back')
  }

  function navigateTo(targetIndex: number) {
    setShowSectionNav(false)
    setShowMenu(false)
    setDirection(targetIndex > stepIndex ? 'forward' : 'back')
    setAnimKey(k => k + 1)
    setStepIndex(targetIndex)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  async function handleSaveAndExit() {
    setShowMenu(false)
    if (currentSection) await saveCurrentStep()
    router.push('/')
  }

  async function handleDiscard() {
    setShowDiscardConfirm(false)
    setShowMenu(false)
    await fetch('/api/onboarding', { method: 'DELETE' })
    setSectionData({
      interests: {}, physical: {}, lifestyle_ext: {}, training_ext: {}, nutrition_ext: {},
      supplements_ext: {}, sleep_ext: {}, skincare: {}, hair: {},
      mental: {}, travel: {}, tech_prefs: {}, coaching: {},
    })
    setDirection('back')
    setAnimKey(k => k + 1)
    setStepIndex(0)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const animStyle: React.CSSProperties = {
    animation: `${direction === 'forward' ? 'slideInRight' : 'slideInLeft'} 0.28s cubic-bezier(0.22,1,0.36,1) both`,
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: '#000', display: 'flex', flexDirection: 'column', maxWidth: '480px', margin: '0 auto' }}>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-40px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 3px solid #000;
          box-shadow: 0 0 0 1.5px #f97316;
        }
        input[type=range]::-moz-range-thumb {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #f97316;
          cursor: pointer;
          border: 3px solid #000;
        }
        select option { background: #111; color: #fff; }
        input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
        input[type=time]::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
      `}</style>

      {/* Progress bar */}
      {!isWelcome && !isDone && (
        <div style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#000', paddingTop: 'env(safe-area-inset-top)' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 0' }}>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setShowMenu(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#52525b', padding: '4px 8px', fontSize: '20px', lineHeight: 1,
                letterSpacing: '2px',
              }}
              aria-label="More options"
            >
              ···
            </button>
          </div>
          <div style={{ height: '3px', backgroundColor: '#1c1c1c' }}>
            <div
              style={{
                height: '100%',
                width: `${((contentIndex + 1) / total) * 100}%`,
                backgroundColor: step.color,
                transition: 'width 0.4s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          </div>
        </div>
      )}

      {/* Save & exit / Discard menu */}
      {showMenu && (
        <div
          onClick={() => setShowMenu(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px', margin: '0 auto',
              backgroundColor: '#111', borderRadius: '24px 24px 0 0',
              border: '1px solid #27272a', borderBottom: 'none',
              padding: '12px 20px calc(28px + env(safe-area-inset-bottom))',
            }}
          >
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: '#3f3f46', margin: '0 auto 20px' }} />
            <div style={{ fontSize: '13px', color: '#52525b', marginBottom: '16px', textAlign: 'center' }}>
              Your progress so far is automatically saved.
            </div>
            <button
              onClick={handleSaveAndExit}
              style={{
                width: '100%', padding: '14px', borderRadius: '14px', marginBottom: '10px',
                backgroundColor: 'rgba(249,115,22,0.1)', border: '1.5px solid rgba(249,115,22,0.3)',
                color: '#f97316', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}
            >
              <span style={{ fontSize: '20px' }}>💾</span>
              <div>
                <div>Save &amp; resume later</div>
                <div style={{ fontSize: '12px', fontWeight: 400, color: '#a16207', marginTop: '2px' }}>
                  Returns to dashboard. Pick up where you left off anytime.
                </div>
              </div>
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowSectionNav(true) }}
              style={{
                width: '100%', padding: '14px', borderRadius: '14px', marginBottom: '10px',
                backgroundColor: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.25)',
                color: '#818cf8', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}
            >
              <span style={{ fontSize: '20px' }}>📋</span>
              <div>
                <div>Jump to section</div>
                <div style={{ fontSize: '12px', fontWeight: 400, color: '#6366f1', marginTop: '2px' }}>
                  Skip ahead or go back to any part.
                </div>
              </div>
            </button>
            <button
              onClick={() => { setShowMenu(false); setShowDiscardConfirm(true) }}
              style={{
                width: '100%', padding: '14px', borderRadius: '14px', marginBottom: '10px',
                backgroundColor: 'rgba(255,107,107,0.08)', border: '1.5px solid rgba(255,107,107,0.2)',
                color: '#ff6b6b', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}
            >
              <span style={{ fontSize: '20px' }}>🗑️</span>
              <div>
                <div>Restart &amp; discard</div>
                <div style={{ fontSize: '12px', fontWeight: 400, color: '#fca5a5', marginTop: '2px' }}>
                  Clears all answers and starts over.
                </div>
              </div>
            </button>
            <button
              onClick={() => setShowMenu(false)}
              style={{
                width: '100%', padding: '14px', borderRadius: '14px',
                backgroundColor: 'transparent', border: '1.5px solid #27272a',
                color: '#71717a', fontSize: '15px', fontWeight: 500, cursor: 'pointer',
              }}
            >
              Keep going
            </button>
          </div>
        </div>
      )}

      {/* Discard confirmation */}
      {showDiscardConfirm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 101,
            backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}
        >
          <div style={{
            width: '100%', maxWidth: '360px', backgroundColor: '#111',
            borderRadius: '20px', border: '1px solid #27272a', padding: '28px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
              Restart from the beginning?
            </div>
            <div style={{ fontSize: '14px', color: '#71717a', lineHeight: 1.6, marginBottom: '24px' }}>
              This will permanently delete everything you&apos;ve entered and take you back to the start.
            </div>
            <button
              onClick={handleDiscard}
              style={{
                width: '100%', padding: '13px', borderRadius: '12px', marginBottom: '10px',
                backgroundColor: '#ff6b6b', border: 'none',
                color: '#0d0c0b', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Yes, discard everything
            </button>
            <button
              onClick={() => setShowDiscardConfirm(false)}
              style={{
                width: '100%', padding: '13px', borderRadius: '12px',
                backgroundColor: 'transparent', border: '1.5px solid #27272a',
                color: '#71717a', fontSize: '15px', fontWeight: 500, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Section navigation sheet */}
      {showSectionNav && (
        <div
          onClick={() => setShowSectionNav(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px', margin: '0 auto',
              backgroundColor: '#111', borderRadius: '24px 24px 0 0',
              border: '1px solid #27272a', borderBottom: 'none',
              padding: '12px 20px calc(28px + env(safe-area-inset-bottom))',
              maxHeight: '80dvh', overflowY: 'auto',
            }}
          >
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: '#3f3f46', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Jump to section</div>
            <div style={{ fontSize: '13px', color: '#52525b', marginBottom: '16px' }}>Tap any section to go there directly.</div>
            <button
              onClick={() => navigateTo(0)}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '12px', marginBottom: '6px',
                backgroundColor: stepIndex === 0 ? 'rgba(249,115,22,0.1)' : 'transparent',
                border: stepIndex === 0 ? '1.5px solid rgba(249,115,22,0.35)' : '1.5px solid #1c1c1c',
                color: stepIndex === 0 ? '#f97316' : '#a1a1aa',
                fontSize: '14px', fontWeight: stepIndex === 0 ? 600 : 400, cursor: 'pointer',
                textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
              }}
            >
              <span style={{ fontSize: '16px' }}>👋</span>
              <span>Welcome</span>
              {stepIndex === 0 && <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#f97316' }}>current</span>}
            </button>
            {CONTENT_STEPS.map((s) => {
              const Icon = s.icon!
              const sIdx = STEPS.findIndex(st => st.id === s.id)
              const isCurrent = stepIndex === sIdx
              const isIncluded = !OPTIONAL_STEP_IDS.has(s.id) || focusedSections.includes(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => navigateTo(sIdx)}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: '12px', marginBottom: '6px',
                    backgroundColor: isCurrent ? `${s.color}18` : 'transparent',
                    border: isCurrent ? `1.5px solid ${s.color}55` : '1.5px solid #1c1c1c',
                    color: isCurrent ? s.color : isIncluded ? '#e4e4e7' : '#52525b',
                    fontSize: '14px', fontWeight: isCurrent ? 600 : 400, cursor: 'pointer',
                    textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                  }}
                >
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                    backgroundColor: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={13} color={s.color} />
                  </div>
                  <span>{s.label}</span>
                  {isCurrent && <span style={{ marginLeft: 'auto', fontSize: '11px', color: s.color }}>current</span>}
                  {!isCurrent && !isIncluded && <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#3f3f46' }}>optional</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isWelcome || isDone ? '0' : '24px 20px 120px' }}>

        {/* Welcome screen */}
        {isWelcome && (
          <div key="welcome" style={{
            minHeight: '100dvh', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'flex-start', padding: '60px 28px 100px', textAlign: 'center',
          }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '24px',
              backgroundColor: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px',
            }}>
              <Flame size={36} color="#f97316" />
            </div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.15 }}>
              Let&apos;s build your profile
            </h1>
            <p style={{ fontSize: '15px', color: '#71717a', lineHeight: 1.7, marginBottom: '40px', maxWidth: '320px' }}>
              Answer a few questions so your AI coach knows exactly who you are, how you live, and what you&apos;re working towards. Takes about 5&ndash;10 minutes. You can skip anything and come back later.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '320px' }}>
              {CONTENT_STEPS.map((s, i) => {
                const Icon = s.icon!
                return (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 16px', borderRadius: '12px',
                    backgroundColor: '#0a0a0a', border: '1px solid #1c1c1c',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                      backgroundColor: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={14} color={s.color} />
                    </div>
                    <span style={{ fontSize: '13px', color: '#a1a1aa' }}>{s.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#3f3f46' }}>{i + 1}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Done screen */}
        {isDone && (
          <DoneScreen
            sectionData={sectionData}
            aiMacros={aiMacros}
            aiMacrosLoading={aiMacrosLoading}
            macrosAccepted={macrosAccepted}
            onAccept={() => setMacrosAccepted(true)}
            onDecline={() => setMacrosAccepted(false)}
          />
        )}

        {/* Category steps */}
        {!isWelcome && !isDone && (
          <div key={animKey} style={animStyle}>
            {/* Step header */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                {step.icon && (
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '10px',
                    backgroundColor: `${step.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <step.icon size={16} color={step.color} />
                  </div>
                )}
                <span style={{ fontSize: '12px', color: step.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {contentIndex + 1} of {total}
                </span>
              </div>
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {step.label}
              </h2>
            </div>

            <StepContent stepId={step.id} data={currentData} set={setField} sectionData={sectionData} whoopData={whoopData} />
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px',
        backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 20px calc(16px + env(safe-area-inset-bottom))',
        display: 'flex', gap: '10px', alignItems: 'center', zIndex: 50,
      }}>
        {/* Back button */}
        {stepIndex > 0 && !isDone && (
          <button
            onClick={handleBack}
            style={{
              width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
              backgroundColor: '#111', border: '1px solid #27272a',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#a1a1aa',
            }}
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {/* Skip button — only on content steps */}
        {!isWelcome && !isDone && (
          <button
            onClick={handleSkip}
            style={{
              flex: 1, height: '44px', borderRadius: '12px',
              backgroundColor: 'transparent', border: '1px solid #27272a',
              color: '#52525b', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Skip
          </button>
        )}

        {/* Next / CTA button */}
        <button
          onClick={handleNext}
          disabled={saving}
          style={{
            flex: isWelcome || isDone ? 1 : 2,
            height: '44px', borderRadius: '12px',
            backgroundColor: isDone ? '#22c55e' : '#f97316',
            border: 'none', color: '#000',
            fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : isDone ? 'Go to dashboard' : isWelcome ? 'Start building my profile' : (
            <>Next <ChevronRight size={16} /></>
          )}
        </button>
      </div>
    </div>
  )
}

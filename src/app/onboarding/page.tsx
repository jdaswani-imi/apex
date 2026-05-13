'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Check,
  User, Calendar, Dumbbell, UtensilsCrossed, Pill,
  Moon, Sparkles, Wind, Brain, Plane, Cpu, Target,
  Plus, Minus, Flame, X,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepId =
  | 'welcome' | 'physical' | 'lifestyle' | 'training' | 'nutrition'
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
  { id: 'lifestyle',  label: 'Lifestyle & Schedule',   icon: Calendar,          color: '#8b5cf6', section: 'lifestyle_ext' },
  { id: 'training',   label: 'Training & Gym',         icon: Dumbbell,          color: '#3b82f6', section: 'training_ext' },
  { id: 'nutrition',  label: 'Nutrition & Diet',       icon: UtensilsCrossed,   color: '#10b981', section: 'nutrition_ext' },
  { id: 'supplements',label: 'Supplements',            icon: Pill,              color: '#f59e0b', section: 'supplements_ext' },
  { id: 'sleep',      label: 'Sleep & Recovery',       icon: Moon,              color: '#6366f1', section: 'sleep_ext' },
  { id: 'skincare',   label: 'Skincare',               icon: Sparkles,          color: '#ec4899', section: 'skincare' },
  { id: 'hair',       label: 'Hair',                   icon: Wind,              color: '#14b8a6', section: 'hair' },
  { id: 'mental',     label: 'Mental & Stress',        icon: Brain,             color: '#f43f5e', section: 'mental' },
  { id: 'travel',     label: 'Travel & Social',        icon: Plane,             color: '#06b6d4', section: 'travel' },
  { id: 'tech',       label: 'Tech & Wearables',       icon: Cpu,               color: '#84cc16', section: 'tech_prefs' },
  { id: 'coaching',   label: 'Coaching Preferences',   icon: Target,            color: '#f97316', section: 'coaching' },
  { id: 'done',       label: 'All done!',              icon: null,              color: '#f97316', section: null },
]

const CONTENT_STEPS = STEPS.filter(s => s.id !== 'welcome' && s.id !== 'done')
const TOTAL = CONTENT_STEPS.length

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

function generateSummary(sectionData: Record<string, any>): string {
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

  const arr = (v: any) => Array.isArray(v) ? v.join(', ') : (v ?? '—')
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
Evening commitments: ${l.evening_commitments_list && l.evening_commitments_list.length > 0
    ? l.evening_commitments_list.map((ec: EveningCommitment) => `${ec.activity} (${ec.days.join(',')}) ${ec.start}–${ec.end}`).join('; ')
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
Coffee: ${val(n.coffee_daily)} cups/day, cut-off ${val(n.coffee_cutoff)}
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

// ─── Step content components ───────────────────────────────────────────────────

function PhysicalStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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
      </Field>

      <Field label="Estimated body fat %" hint="Rough estimate is fine">
        <Stepper value={data.body_fat_pct ?? 20} onChange={v => set('body_fat_pct', v)} min={5} max={50} suffix="%" />
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

function LifestyleStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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
      <Field label="Do you travel often?">
        <Chips
          options={['Rarely', '1–2x per month', 'Weekly', 'Constantly']}
          value={data.travel_frequency ?? ''}
          onChange={v => set('travel_frequency', v)}
        />
      </Field>
    </>
  )
}

function TrainingStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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
    </>
  )
}

function NutritionStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
  const dietType = data.diet_type ?? ''

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
    'Pasta', 'Rice', 'Cheese', 'Alcohol', 'Desserts', 'Coffee / caffeine', 'Fruit',
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

      <Field label="Coffee — cups per day">
        <Stepper value={data.coffee_daily ?? 2} onChange={v => set('coffee_daily', v)} min={0} max={10} suffix=" cups" />
      </Field>
      <Field label="Coffee cut-off time">
        <input type="time" value={data.coffee_cutoff ?? '16:00'} onChange={e => set('coffee_cutoff', e.target.value)} style={inputStyle} />
      </Field>
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

      <Field label="Daily water intake">
        <Stepper value={data.water_liters ?? 2} onChange={v => set('water_liters', v)} min={0} max={8} step={1} suffix="L" />
      </Field>
      <Field label="Do you use electrolytes?">
        <Toggle value={data.uses_electrolytes ?? false} onChange={v => set('uses_electrolytes', v)} />
      </Field>
    </>
  )
}

function SupplementsStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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

function SleepStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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

function SkincareStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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

function HairStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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

function MentalStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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
      <Field label="Overall life satisfaction" hint="1 = struggling, 10 = thriving">
        <RangeSlider value={data.life_satisfaction ?? 6} onChange={v => set('life_satisfaction', v)} min={1} max={10} />
      </Field>
    </>
  )
}

function TravelStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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

function TechStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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

function CoachingStep({ data, set }: { data: any; set: (k: string, v: any) => void }) {
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

// ─── Step renderer ─────────────────────────────────────────────────────────────

function StepContent({ stepId, data, set }: { stepId: StepId; data: any; set: (k: string, v: any) => void }) {
  switch (stepId) {
    case 'physical':    return <PhysicalStep data={data} set={set} />
    case 'lifestyle':   return <LifestyleStep data={data} set={set} />
    case 'training':    return <TrainingStep data={data} set={set} />
    case 'nutrition':   return <NutritionStep data={data} set={set} />
    case 'supplements': return <SupplementsStep data={data} set={set} />
    case 'sleep':       return <SleepStep data={data} set={set} />
    case 'skincare':    return <SkincareStep data={data} set={set} />
    case 'hair':        return <HairStep data={data} set={set} />
    case 'mental':      return <MentalStep data={data} set={set} />
    case 'travel':      return <TravelStep data={data} set={set} />
    case 'tech':        return <TechStep data={data} set={set} />
    case 'coaching':    return <CoachingStep data={data} set={set} />
    default:            return null
  }
}

// ─── Done screen ───────────────────────────────────────────────────────────────

function DoneScreen({ sectionData }: { sectionData: Record<string, any> }) {
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
      alignItems: 'center', justifyContent: 'center', padding: '40px 28px', textAlign: 'center',
    }}>
      <div style={{
        width: '80px', height: '80px', borderRadius: '24px',
        backgroundColor: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px',
      }}>
        <Check size={36} color="#22c55e" />
      </div>
      <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
        You're all set
      </h1>
      <p style={{ fontSize: '15px', color: '#71717a', lineHeight: 1.7, marginBottom: '16px', maxWidth: '300px' }}>
        Your profile is saved. Your AI coach now has full context to personalise everything — training, nutrition, recovery, and more.
      </p>
      <p style={{ fontSize: '13px', color: '#3f3f46', marginBottom: '32px' }}>
        You can update any section anytime from Settings.
      </p>
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

export default function OnboardingPage() {
  const router = useRouter()
  const [stepIndex, setStepIndex] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [animKey, setAnimKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [sectionData, setSectionData] = useState<Record<string, any>>({
    physical: {}, lifestyle_ext: {}, training_ext: {}, nutrition_ext: {},
    supplements_ext: {}, sleep_ext: {}, skincare: {}, hair: {},
    mental: {}, travel: {}, tech_prefs: {}, coaching: {},
  })

  const step = STEPS[stepIndex]
  const isWelcome = step.id === 'welcome'
  const isDone = step.id === 'done'
  const contentIndex = CONTENT_STEPS.findIndex(s => s.id === step.id)

  // Load existing data
  useEffect(() => {
    fetch('/api/onboarding')
      .then(r => r.json())
      .then(d => {
        if (d && Object.keys(d).length > 0) {
          setSectionData(prev => ({
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
          if (d.current_step && d.current_step > 0 && !d.completed) {
            setStepIndex(Math.min(d.current_step, STEPS.length - 1))
          }
        }
      })
      .catch(() => {})
  }, [])

  const currentSection = step.section
  const currentData = currentSection ? (sectionData[currentSection] ?? {}) : {}

  const setField = useCallback((k: string, v: any) => {
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
    setDirection(dir)
    setAnimKey(k => k + 1)
    if (dir === 'forward') setStepIndex(i => Math.min(i + 1, STEPS.length - 1))
    else setStepIndex(i => Math.max(i - 1, 0))
  }

  async function handleNext() {
    if (!isWelcome && !isDone && currentSection) await saveCurrentStep()
    if (isDone) {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })
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

  async function handleSaveAndExit() {
    setShowMenu(false)
    if (currentSection) await saveCurrentStep()
    router.push('/')
  }

  async function handleDiscard() {
    setShowDiscardConfirm(false)
    setShowMenu(false)
    await fetch('/api/onboarding', { method: 'DELETE' })
    router.push('/')
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
                width: `${((contentIndex + 1) / TOTAL) * 100}%`,
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
              onClick={() => { setShowMenu(false); setShowDiscardConfirm(true) }}
              style={{
                width: '100%', padding: '14px', borderRadius: '14px', marginBottom: '10px',
                backgroundColor: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.2)',
                color: '#ef4444', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}
            >
              <span style={{ fontSize: '20px' }}>🗑️</span>
              <div>
                <div>Exit &amp; discard</div>
                <div style={{ fontSize: '12px', fontWeight: 400, color: '#b91c1c', marginTop: '2px' }}>
                  Clears all answers. Cannot be undone.
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
              Discard all answers?
            </div>
            <div style={{ fontSize: '14px', color: '#71717a', lineHeight: 1.6, marginBottom: '24px' }}>
              This will permanently delete everything you've entered. You'll need to start from scratch.
            </div>
            <button
              onClick={handleDiscard}
              style={{
                width: '100%', padding: '13px', borderRadius: '12px', marginBottom: '10px',
                backgroundColor: '#ef4444', border: 'none',
                color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
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
              Let's build your profile
            </h1>
            <p style={{ fontSize: '15px', color: '#71717a', lineHeight: 1.7, marginBottom: '40px', maxWidth: '320px' }}>
              Answer a few questions so your AI coach knows exactly who you are, how you live, and what you're working towards. Takes about 5–10 minutes. You can skip anything and come back later.
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
        {isDone && <DoneScreen sectionData={sectionData} />}

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
                  {contentIndex + 1} of {TOTAL}
                </span>
              </div>
              <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {step.label}
              </h2>
            </div>

            <StepContent stepId={step.id} data={currentData} set={setField} />
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

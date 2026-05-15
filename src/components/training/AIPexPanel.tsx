'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Sparkles, Play, RefreshCw, ChevronRight, Dumbbell, Zap, Clock,
  AlertCircle, ChevronDown, ChevronUp, Info, PenLine, BarChart2,
} from 'lucide-react'

interface TemplateExercise {
  id: string
  exercise_name: string
  sort_order: number
  default_sets: number | null
  default_reps: number | null
  notes: string | null
}

interface TemplateSection {
  id: string
  name: string
  sort_order: number
  template_exercises: TemplateExercise[]
}

interface Template {
  id: string
  name: string
  description: string
  color: string
  sort_order: number
  day_of_week?: string | null
  ai_rationale?: string | null
  template_sections?: TemplateSection[]
}

interface AIPexStatus {
  plan: {
    status: 'setup' | 'assessment' | 'active'
    assessment_done: boolean
    gym_type: string | null
    training_days: string[]
    plan_notes: string | null
  } | null
  has_history: boolean
  session_count: number
  templates: Template[]
  training_days: string[]
  gym_type: string | null
  baseline_count: number
}

interface Props {
  onSelectTemplate: (templateId: string, templateName: string, templateColor: string) => void
  gender?: string
}

const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu',
  Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun',
  Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu',
  Fri: 'Fri', Sat: 'Sat', Sun: 'Sun',
}

const SHORT_TO_FULL: Record<string, string> = {
  Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday',
  Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday',
}

const ORDERED_DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ORDERED_DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function todayShort(): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]
}

function totalExerciseCount(template: Template): number {
  return (template.template_sections ?? []).reduce(
    (acc, s) => acc + (s.template_exercises?.length ?? 0), 0
  )
}

export default function AIPexPanel({ onSelectTemplate }: Props) {
  const [status, setStatus] = useState<AIPexStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatingMode, setGeneratingMode] = useState<'assessment' | 'full' | null>(null)
  const [showHowBuilt, setShowHowBuilt] = useState(false)

  const fetchStatus = useCallback(async () => {
    const res = await fetch('/api/training/ai-pex/status')
    const data = await res.json()
    setStatus(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  async function generate(mode: 'assessment' | 'full') {
    setGenerating(true)
    setGeneratingMode(mode)
    try {
      await fetch('/api/training/ai-pex/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      await fetchStatus()
    } finally {
      setGenerating(false)
      setGeneratingMode(null)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[160, 80, 80].map((h, i) => (
          <div key={i} style={{ height: `${h}px`, backgroundColor: '#111', borderRadius: '20px', border: '1px solid #1c1c1c' }} />
        ))}
      </div>
    )
  }

  // ── No plan yet ──────────────────────────────────────────────────────────────
  if (!status?.plan || status.plan.status === 'setup') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <SetupCard
          status={status}
          generating={generating}
          generatingMode={generatingMode}
          onGenerate={generate}
        />
      </div>
    )
  }

  // ── Assessment pending ───────────────────────────────────────────────────────
  if (status.plan.status === 'assessment' && !status.plan.assessment_done) {
    const assessTemplate = status.templates[0]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <AssessmentBanner
          template={assessTemplate}
          onStart={() => assessTemplate && onSelectTemplate(assessTemplate.id, assessTemplate.name, assessTemplate.color)}
          onGenerateFull={() => generate('full')}
          generating={generating}
        />
      </div>
    )
  }

  // ── Active plan ──────────────────────────────────────────────────────────────
  const today = todayShort()
  const planDays = status.plan.training_days?.length > 0
    ? status.plan.training_days
    : ORDERED_DAYS_SHORT

  const templatesByIndex = [...status.templates].sort((a, b) => a.sort_order - b.sort_order)

  // Map templates to ordered training days
  const trainingDaysOrdered = ORDERED_DAYS_SHORT.filter(d =>
    planDays.includes(d) || planDays.includes(SHORT_TO_FULL[d] ?? '')
  )

  const dayTemplateMap: Array<{ day: string; template: Template }> = trainingDaysOrdered
    .map((day, idx) => {
      // Try matching by day_of_week first
      const byDow = templatesByIndex.find(t =>
        t.day_of_week === day ||
        t.day_of_week === SHORT_TO_FULL[day] ||
        t.day_of_week === DAY_ABBR[day]
      )
      const template = byDow ?? templatesByIndex[idx]
      return template ? { day, template } : null
    })
    .filter((x): x is { day: string; template: Template } => x !== null)

  const isToday = (day: string) => day === today || SHORT_TO_FULL[day] === SHORT_TO_FULL[today]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        backgroundColor: '#111', border: '1px solid #1c1c1c', borderRadius: '18px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={15} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Your AI Plan</div>
            <div style={{ fontSize: '11px', color: '#52525b' }}>
              {templatesByIndex.length} workouts · {trainingDaysOrdered.length}×/week
            </div>
          </div>
        </div>
        <button
          onClick={() => generate('full')}
          disabled={generating}
          title="Regenerate plan"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 12px', borderRadius: '10px',
            backgroundColor: '#1c1c1c', border: '1px solid #2a2a2a',
            color: '#71717a', fontSize: '12px', fontWeight: 600,
            cursor: generating ? 'default' : 'pointer',
          }}
        >
          <RefreshCw size={13} style={generating ? { animation: 'spin 1s linear infinite' } : {}} />
          {generating ? 'Updating…' : 'Regenerate'}
        </button>
      </div>

      {/* Draft notice */}
      <div style={{
        display: 'flex', gap: '10px', alignItems: 'flex-start',
        padding: '12px 14px',
        backgroundColor: '#0f0f0f', border: '1px solid #f97316' + '22', borderRadius: '14px',
      }}>
        <PenLine size={14} color="#f97316" style={{ marginTop: '1px', flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', letterSpacing: '0.06em', marginBottom: '3px' }}>
            AI DRAFT · WEEK 1
          </div>
          <p style={{ fontSize: '12px', color: '#52525b', margin: 0, lineHeight: 1.5 }}>
            This is a starting point — not a final prescription. Every exercise, weight, and rep range is editable. Tap any workout to review before you start.
          </p>
        </div>
      </div>

      {/* No baseline data warning */}
      {status.baseline_count === 0 && (
        <div style={{
          display: 'flex', gap: '10px', alignItems: 'flex-start',
          padding: '12px 14px',
          backgroundColor: '#0f0f0f', border: '1px solid #ef4444' + '33', borderRadius: '14px',
        }}>
          <AlertCircle size={14} color="#ef4444" style={{ marginTop: '1px', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', letterSpacing: '0.06em', marginBottom: '3px' }}>
              NO STRENGTH DATA YET
            </div>
            <p style={{ fontSize: '12px', color: '#52525b', margin: 0, lineHeight: 1.5 }}>
              AI-PEX estimated starting weights. Complete your first session and log actual weights — the plan will improve from there.
            </p>
          </div>
        </div>
      )}

      {/* How this plan was built — collapsible */}
      <div style={{
        backgroundColor: '#0a0a0a', border: '1px solid #1c1c1c', borderRadius: '16px',
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setShowHowBuilt(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', backgroundColor: 'transparent', border: 'none',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={13} color="#52525b" />
            <span style={{ fontSize: '12px', color: '#52525b', fontWeight: 600 }}>How this plan was built</span>
          </div>
          {showHowBuilt
            ? <ChevronUp size={14} color="#3f3f46" />
            : <ChevronDown size={14} color="#3f3f46" />
          }
        </button>

        {showHowBuilt && (
          <div style={{ padding: '0 14px 14px', borderTop: '1px solid #1c1c1c' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {[
                { icon: '📊', label: `${status.session_count} training session${status.session_count !== 1 ? 's' : ''} analysed` },
                { icon: '💪', label: `${status.baseline_count} exercise baseline${status.baseline_count !== 1 ? 's' : ''} found` },
                { icon: '🏋️', label: `Gym: ${status.gym_type ?? 'Commercial gym'}` },
                { icon: '📅', label: `${trainingDaysOrdered.length}×/week training split` },
              ].map(({ icon, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13px' }}>{icon}</span>
                  <span style={{ fontSize: '12px', color: '#71717a' }}>{label}</span>
                </div>
              ))}
            </div>
            {status.plan.plan_notes && (
              <p style={{
                fontSize: '12px', color: '#52525b', lineHeight: 1.6,
                margin: '12px 0 0', borderTop: '1px solid #1c1c1c', paddingTop: '12px',
              }}>
                {status.plan.plan_notes}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Weekly schedule */}
      <div style={{ fontSize: '11px', color: '#3f3f46', fontWeight: 600, letterSpacing: '0.06em', marginTop: '4px' }}>
        THIS WEEK
      </div>

      {dayTemplateMap.map(({ day, template }) => (
        <WorkoutDayCard
          key={day}
          day={day}
          template={template}
          isToday={isToday(day)}
          onStart={() => onSelectTemplate(template.id, template.name, template.color)}
        />
      ))}
    </div>
  )
}

// ── Setup card ───────────────────────────────────────────────────────────────

function SetupCard({
  status,
  generating,
  generatingMode,
  onGenerate,
}: {
  status: AIPexStatus | null
  generating: boolean
  generatingMode: 'assessment' | 'full' | null
  onGenerate: (mode: 'assessment' | 'full') => void
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1205 50%, #0f0f0f 100%)',
      border: '1px solid #2a1f0a', borderRadius: '24px', padding: '28px 24px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-40px', right: '-40px',
        width: '160px', height: '160px',
        background: 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #f97316, #ea580c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>AI-PEX</div>
          <div style={{ fontSize: '11px', color: '#f97316', fontWeight: 600, letterSpacing: '0.05em' }}>YOUR AI TRAINER</div>
        </div>
      </div>
      <p style={{ fontSize: '14px', color: '#a1a1aa', lineHeight: 1.6, margin: '0 0 20px' }}>
        AI-PEX builds a personalised training plan from your goals, equipment, and recovery data — then adapts it as you train.
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {[
          { icon: <Dumbbell size={11} />, label: status?.gym_type ?? 'Auto-detected gym' },
          { icon: <Zap size={11} />, label: status?.has_history ? `${status.session_count} sessions logged` : 'Assessment first' },
          { icon: <Clock size={11} />, label: status?.training_days?.length ? `${status.training_days.length} days/week` : 'Custom schedule' },
        ].map((chip, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '5px 10px', borderRadius: '100px',
            backgroundColor: '#1c1c1c', border: '1px solid #2a2a2a',
          }}>
            <span style={{ color: '#f97316' }}>{chip.icon}</span>
            <span style={{ fontSize: '11px', color: '#71717a', fontWeight: 500 }}>{chip.label}</span>
          </div>
        ))}
      </div>
      {status?.has_history ? (
        <button
          onClick={() => onGenerate('full')}
          disabled={generating}
          style={{
            width: '100%', padding: '14px',
            background: generating ? '#1c1c1c' : 'linear-gradient(135deg, #f97316, #ea580c)',
            border: 'none', borderRadius: '14px',
            color: generating ? '#52525b' : '#fff',
            fontSize: '15px', fontWeight: 700,
            cursor: generating ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {generating ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Building your plan…</> : <><Sparkles size={16} /> Build My Training Plan</>}
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => onGenerate('assessment')}
            disabled={generating}
            style={{
              width: '100%', padding: '14px',
              background: generating && generatingMode === 'assessment' ? '#1c1c1c' : 'linear-gradient(135deg, #f97316, #ea580c)',
              border: 'none', borderRadius: '14px',
              color: generating && generatingMode === 'assessment' ? '#52525b' : '#fff',
              fontSize: '15px', fontWeight: 700,
              cursor: generating ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {generating && generatingMode === 'assessment'
              ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Creating assessment…</>
              : <><Sparkles size={16} /> Start with Assessment Workout</>
            }
          </button>
          <p style={{ fontSize: '12px', color: '#52525b', textAlign: 'center', margin: 0 }}>
            AI-PEX needs to learn your strength — complete the assessment first, then your full plan is generated.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Assessment banner ────────────────────────────────────────────────────────

function AssessmentBanner({
  template, onStart, onGenerateFull, generating,
}: {
  template: Template | undefined
  onStart: () => void
  onGenerateFull: () => void
  generating: boolean
}) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f0f0f 0%, #0f1a0f 100%)',
      border: '1px solid #1a2e1a', borderRadius: '24px', padding: '24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '10px', backgroundColor: '#f97316',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Assessment Ready</div>
          <div style={{ fontSize: '11px', color: '#f97316' }}>COMPLETE BEFORE FULL PLAN UNLOCKS</div>
        </div>
      </div>
      <p style={{ fontSize: '13px', color: '#a1a1aa', lineHeight: 1.6, margin: '0 0 20px' }}>
        AI-PEX has built a baseline assessment workout. Complete it to establish your strength levels — then your personalised weekly plan is generated automatically.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {template && (
          <button
            onClick={onStart}
            style={{
              width: '100%', padding: '14px',
              background: 'linear-gradient(135deg, #f97316, #ea580c)',
              border: 'none', borderRadius: '14px',
              color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <Play size={16} fill="#fff" /> Start Assessment Workout
          </button>
        )}
        <button
          onClick={onGenerateFull}
          disabled={generating}
          style={{
            width: '100%', padding: '12px', background: 'transparent',
            border: '1px solid #2a2a2a', borderRadius: '14px',
            color: '#52525b', fontSize: '13px', fontWeight: 600,
            cursor: generating ? 'default' : 'pointer',
          }}
        >
          {generating ? 'Generating full plan…' : 'Skip assessment → Build full plan now'}
        </button>
      </div>
    </div>
  )
}

// ── Workout day card (expandable) ────────────────────────────────────────────

function WorkoutDayCard({
  day, template, isToday, onStart,
}: {
  day: string
  template: Template
  isToday: boolean
  onStart: () => void
}) {
  const [expanded, setExpanded] = useState(isToday)
  const [showRationale, setShowRationale] = useState(false)

  const sections = [...(template.template_sections ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const exerciseCount = totalExerciseCount(template)

  return (
    <div style={{
      backgroundColor: isToday ? '#111' : '#0a0a0a',
      border: `1px solid ${isToday ? template.color + '44' : '#1c1c1c'}`,
      borderRadius: '18px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {isToday && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: `linear-gradient(90deg, ${template.color}, transparent)`,
        }} />
      )}

      {/* Card header row */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          padding: '14px 14px 14px 16px', cursor: 'pointer',
        }}
      >
        {/* Day indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '36px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: template.color }} />
          <span style={{
            fontSize: '11px', fontWeight: 700,
            color: isToday ? '#fff' : '#52525b', letterSpacing: '0.05em',
          }}>
            {DAY_ABBR[day] ?? day.slice(0, 3).toUpperCase()}
          </span>
          {isToday && (
            <span style={{ fontSize: '9px', fontWeight: 700, color: template.color, letterSpacing: '0.05em' }}>TODAY</span>
          )}
        </div>

        {/* Name */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: isToday ? '#fff' : '#a1a1aa' }}>
            {template.name}
          </div>
          <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>
            {template.description}
            {exerciseCount > 0 && ` · ${exerciseCount} exercises`}
          </div>
        </div>

        {/* Expand / Start */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {expanded
            ? <ChevronUp size={14} color="#3f3f46" />
            : <ChevronDown size={14} color="#3f3f46" />
          }
          <button
            onClick={e => { e.stopPropagation(); onStart() }}
            style={{
              width: '38px', height: '38px', borderRadius: '12px',
              backgroundColor: isToday ? template.color + '22' : '#1c1c1c',
              border: `1px solid ${isToday ? template.color + '44' : '#2a2a2a'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {isToday
              ? <Play size={15} color={template.color} fill={template.color} />
              : <ChevronRight size={15} color="#52525b" />
            }
          </button>
        </div>
      </div>

      {/* Expanded exercise list */}
      {expanded && sections.length > 0 && (
        <div style={{ borderTop: '1px solid #1c1c1c', padding: '12px 16px 4px' }}>
          {sections.map(section => {
            const exercises = [...(section.template_exercises ?? [])].sort((a, b) => a.sort_order - b.sort_order)
            const visibleExercises = exercises.slice(0, 4)
            const hiddenCount = exercises.length - visibleExercises.length

            return (
              <div key={section.id} style={{ marginBottom: '12px' }}>
                <div style={{
                  fontSize: '10px', fontWeight: 700, color: '#3f3f46',
                  letterSpacing: '0.07em', marginBottom: '6px',
                }}>
                  {section.name.toUpperCase()}
                </div>
                {visibleExercises.map(ex => (
                  <div
                    key={ex.id}
                    style={{
                      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                      paddingBottom: '5px',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#a1a1aa', flex: 1, minWidth: 0, paddingRight: '8px' }}>
                      {ex.exercise_name}
                    </span>
                    <span style={{ fontSize: '11px', color: '#52525b', flexShrink: 0 }}>
                      {(() => {
                        const sets = ex.default_sets ?? 3
                        // notes may start with "8-10 reps" — extract range if present
                        const rangeMatch = ex.notes?.match(/^(\d[\d-]*)(\s*reps)?/)
                        const reps = rangeMatch ? rangeMatch[1] : String(ex.default_reps ?? 10)
                        return `${sets}×${reps}`
                      })()}
                    </span>
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <p style={{ fontSize: '11px', color: '#3f3f46', margin: '4px 0 0' }}>
                    +{hiddenCount} more exercise{hiddenCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )
          })}

          {/* AI rationale */}
          {template.ai_rationale && (
            <div style={{ borderTop: '1px solid #1c1c1c', paddingTop: '10px', marginBottom: '12px' }}>
              <button
                onClick={() => setShowRationale(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  backgroundColor: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                <Info size={12} color="#52525b" />
                <span style={{ fontSize: '11px', color: '#52525b', fontWeight: 600 }}>
                  Why this workout?
                </span>
                {showRationale ? <ChevronUp size={11} color="#3f3f46" /> : <ChevronDown size={11} color="#3f3f46" />}
              </button>
              {showRationale && (
                <p style={{
                  fontSize: '12px', color: '#52525b', lineHeight: 1.55,
                  margin: '8px 0 0',
                }}>
                  {template.ai_rationale}
                </p>
              )}
            </div>
          )}

          {/* No exercises yet prompt */}
          {sections.every(s => (s.template_exercises ?? []).length === 0) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px', borderRadius: '10px',
              backgroundColor: '#111', marginBottom: '12px',
            }}>
              <Dumbbell size={13} color="#3f3f46" />
              <p style={{ fontSize: '12px', color: '#3f3f46', margin: 0 }}>
                No exercises loaded — tap Start to begin and log manually.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Play, Clock, Dumbbell, ChevronDown, ChevronUp, X } from 'lucide-react'

interface TemplateSet {
  id: string
  set_type: 'warmup' | 'working'
  set_number: number
  default_reps: number
  default_weight_kg: number
}

interface TemplateExercise {
  id: string
  exercise_name: string
  sort_order: number
  default_sets: number
  default_reps: number
  default_weight_kg: number
  rest_seconds: number
  notes: string | null
  sets: TemplateSet[]
}

interface TemplateSection {
  id: string
  name: string
  sort_order: number
  exercises: TemplateExercise[]
}

interface ExerciseMedia {
  gif_url: string | null
  gif_url_female: string | null
  instructions: string[]
  primary_muscles: string[]
  secondary_muscles: string[]
  equipment: string | null
  level: string | null
  mechanic: string | null
  force: string | null
  category: string | null
}

interface TemplateData {
  id: string
  name: string
  description: string
  color: string
  sections: TemplateSection[]
  last_session: { date: string; volume_kg: number; duration_min: number } | null
  exercise_media: Record<string, ExerciseMedia>
}

interface Props {
  templateId: string
  templateName: string
  templateColor: string
  gender?: string
  onStart: () => void
  onBack: () => void
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function ExerciseSheet({ name, media, gender, onClose }: {
  name: string
  media: ExerciseMedia
  gender: string
  onClose: () => void
}) {
  const gifUrl = gender === 'female' ? (media.gif_url_female ?? media.gif_url) : media.gif_url

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
          zIndex: 100, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
        backgroundColor: '#111', borderRadius: '24px 24px 0 0',
        border: '1px solid #1c1c1c', borderBottom: 'none',
        maxHeight: '85vh', overflowY: 'auto',
        padding: '0 0 40px',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: '#2d2d2d' }} />
        </div>

        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 16px 0' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#52525b' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '0 20px' }}>
          {/* GIF */}
          {gifUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <img
                src={gifUrl}
                alt={name}
                style={{ width: '200px', height: '200px', borderRadius: '16px', objectFit: 'cover', backgroundColor: '#1a1a1a' }}
              />
            </div>
          )}

          {/* Name */}
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{name}</h2>

          {/* Tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '12px 0 20px' }}>
            {media.category && (
              <span style={{ fontSize: '11px', color: '#a1a1aa', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '2px 8px' }}>
                {capitalize(media.category)}
              </span>
            )}
            {media.equipment && (
              <span style={{ fontSize: '11px', color: '#a1a1aa', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '2px 8px' }}>
                {capitalize(media.equipment)}
              </span>
            )}
            {media.level && (
              <span style={{ fontSize: '11px', color: '#a1a1aa', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '2px 8px' }}>
                {capitalize(media.level)}
              </span>
            )}
            {media.mechanic && (
              <span style={{ fontSize: '11px', color: '#a1a1aa', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '2px 8px' }}>
                {capitalize(media.mechanic)}
              </span>
            )}
            {media.force && (
              <span style={{ fontSize: '11px', color: '#a1a1aa', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '2px 8px' }}>
                {capitalize(media.force)}
              </span>
            )}
          </div>

          {/* Muscles */}
          {media.primary_muscles.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Primary Muscles
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {media.primary_muscles.map(m => (
                  <span key={m} style={{ fontSize: '12px', color: '#e4e4e7', backgroundColor: '#1c1c1c', border: '1px solid #27272a', borderRadius: '6px', padding: '3px 10px' }}>
                    {capitalize(m)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {media.secondary_muscles.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Secondary Muscles
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {media.secondary_muscles.map(m => (
                  <span key={m} style={{ fontSize: '12px', color: '#71717a', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px', padding: '3px 10px' }}>
                    {capitalize(m)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          {media.instructions.length > 0 && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Instructions
              </div>
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {media.instructions.map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{
                      minWidth: '24px', height: '24px', borderRadius: '50%',
                      backgroundColor: '#1c1c1c', border: '1px solid #27272a',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, color: '#71717a', flexShrink: 0,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: '14px', color: '#a1a1aa', lineHeight: '1.55', paddingTop: '2px' }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function TemplateDetail({ templateId, templateName, templateColor, gender = 'male', onStart, onBack }: Props) {
  const [data, setData] = useState<TemplateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [sheet, setSheet] = useState<{ name: string; media: ExerciseMedia } | null>(null)

  useEffect(() => {
    fetch(`/api/training/templates/${templateId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        const init: Record<string, boolean> = {}
        d.sections?.forEach((s: TemplateSection) => { init[s.id] = true })
        setExpanded(init)
        setLoading(false)
      })
  }, [templateId])

  function toggle(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', padding: '48px 20px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '60px' }}>
          {[...Array(4)].map((_, i) => (
            <div key={i} style={{ height: '64px', backgroundColor: '#111', borderRadius: '14px', border: '1px solid #1c1c1c' }} />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const totalExercises = data.sections.reduce((n, s) => n + s.exercises.length, 0)

  return (
    <>
      <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '48px 20px 0', flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#71717a', fontSize: '14px', padding: '0 0 20px', marginLeft: '-4px' }}
          >
            <ArrowLeft size={16} />
            Templates
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: templateColor, flexShrink: 0, marginTop: '6px' }} />
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#fff', margin: 0 }}>{data.name}</h1>
              {data.description && (
                <p style={{ fontSize: '13px', color: '#71717a', margin: '4px 0 0' }}>{data.description}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '16px', margin: '16px 0 20px', paddingLeft: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Dumbbell size={13} color="#52525b" />
              <span style={{ fontSize: '12px', color: '#52525b' }}>{totalExercises} exercise{totalExercises !== 1 ? 's' : ''}</span>
            </div>
            {data.last_session && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Clock size={13} color="#52525b" />
                <span style={{ fontSize: '12px', color: '#52525b' }}>Last: {new Date(data.last_session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
            )}
          </div>

          {/* Start button */}
          <button
            onClick={onStart}
            style={{
              width: '100%', padding: '16px',
              backgroundColor: templateColor,
              border: 'none', borderRadius: '16px',
              color: '#000', fontSize: '16px', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: '8px', marginBottom: '28px',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Play size={18} fill="#000" />
            Start Workout
          </button>
        </div>

        {/* Sections + exercises */}
        <div style={{ flex: 1, padding: '0 20px 40px', overflowY: 'auto' }}>
          {data.sections.map(section => (
            <div key={section.id} style={{ marginBottom: '12px' }}>
              <button
                onClick={() => toggle(section.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 0 10px', marginBottom: '4px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#52525b', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {section.name}
                </span>
                {expanded[section.id]
                  ? <ChevronUp size={14} color="#3f3f46" />
                  : <ChevronDown size={14} color="#3f3f46" />}
              </button>

              {expanded[section.id] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {section.exercises.map(ex => {
                    const media = data.exercise_media[ex.exercise_name]
                    const gifUrl = media
                      ? (gender === 'female' ? (media.gif_url_female ?? media.gif_url) : media.gif_url)
                      : null

                    const workingSets = ex.sets.filter(s => s.set_type === 'working')
                    const warmupSets = ex.sets.filter(s => s.set_type === 'warmup')
                    const hasInstructions = media && (media.instructions.length > 0 || media.primary_muscles.length > 0)

                    return (
                      <div
                        key={ex.id}
                        style={{
                          backgroundColor: '#111', border: '1px solid #1c1c1c',
                          borderRadius: '14px', padding: '14px',
                          display: 'flex', gap: '12px', alignItems: 'flex-start',
                        }}
                      >
                        {/* GIF thumbnail — tappable */}
                        <button
                          onClick={() => media && setSheet({ name: ex.exercise_name, media })}
                          disabled={!hasInstructions}
                          style={{
                            width: '52px', height: '52px', borderRadius: '10px',
                            overflow: 'hidden', flexShrink: 0, padding: 0, border: 'none',
                            backgroundColor: '#1a1a1a', cursor: hasInstructions ? 'pointer' : 'default',
                          }}
                        >
                          {gifUrl
                            ? <img src={gifUrl} alt={ex.exercise_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Dumbbell size={20} color="#27272a" /></div>
                          }
                        </button>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Exercise name — tappable to open sheet */}
                          <button
                            onClick={() => media && setSheet({ name: ex.exercise_name, media })}
                            disabled={!hasInstructions}
                            style={{
                              background: 'none', border: 'none', padding: 0,
                              cursor: hasInstructions ? 'pointer' : 'default',
                              textAlign: 'left', marginBottom: '6px', display: 'block',
                            }}
                          >
                            <span style={{
                              fontSize: '15px', fontWeight: 600, color: '#fff',
                              borderBottom: hasInstructions ? '1px solid #3f3f46' : 'none',
                              paddingBottom: hasInstructions ? '1px' : '0',
                            }}>
                              {ex.exercise_name}
                            </span>
                          </button>

                          {/* Set summary pills */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {warmupSets.length > 0 && (
                              <span style={{
                                fontSize: '11px', color: '#a16207',
                                backgroundColor: '#1c1508', border: '1px solid #2d2008',
                                borderRadius: '6px', padding: '2px 8px', fontWeight: 500,
                              }}>
                                {warmupSets.length}× warmup
                              </span>
                            )}
                            {workingSets.length > 0 ? (
                              workingSets.map((s, i) => (
                                <span key={i} style={{
                                  fontSize: '11px', color: '#a1a1aa',
                                  backgroundColor: '#18181b', border: '1px solid #27272a',
                                  borderRadius: '6px', padding: '2px 8px',
                                }}>
                                  {s.default_reps} reps{s.default_weight_kg > 0 ? ` @ ${s.default_weight_kg}kg` : ''}
                                </span>
                              ))
                            ) : ex.default_sets > 0 ? (
                              <span style={{
                                fontSize: '11px', color: '#a1a1aa',
                                backgroundColor: '#18181b', border: '1px solid #27272a',
                                borderRadius: '6px', padding: '2px 8px',
                              }}>
                                {ex.default_sets}×{ex.default_reps} reps
                              </span>
                            ) : null}
                          </div>

                          {ex.notes && (
                            <div style={{ fontSize: '11px', color: '#52525b', marginTop: '6px', fontStyle: 'italic' }}>
                              {ex.notes}
                            </div>
                          )}

                          {ex.rest_seconds > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                              <Clock size={10} color="#3f3f46" />
                              <span style={{ fontSize: '11px', color: '#3f3f46' }}>
                                {ex.rest_seconds >= 60 ? `${ex.rest_seconds / 60}min` : `${ex.rest_seconds}s`} rest
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Exercise instruction sheet */}
      {sheet && (
        <ExerciseSheet
          name={sheet.name}
          media={sheet.media}
          gender={gender}
          onClose={() => setSheet(null)}
        />
      )}
    </>
  )
}

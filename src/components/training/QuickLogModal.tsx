'use client'

import { useRef, useState } from 'react'
import { todayLocal } from '@/lib/date'
import { X, Camera, Upload, Loader2, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const SESSION_TYPES = [
  'Strength',
  'Cardio',
  'HIIT',
  'Yoga',
  'Pilates',
  'Swimming',
  'Cycling',
  'Running',
  'Sport',
  'Cricket',
  'Walk',
  'Other',
]

const CARDIO_TYPES = new Set(['Cardio', 'HIIT', 'Running', 'Cycling', 'Swimming', 'Walk'])

const TODAY = todayLocal()

function formatDateLabel(d: string) {
  if (d === TODAY) return 'Today'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (d === yesterday.toISOString().split('T')[0]) return 'Yesterday'
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

interface Props {
  onClose: () => void
  onLogged: () => void
}

export default function QuickLogModal({ onClose, onLogged }: Props) {
  const [sessionType, setSessionType] = useState('')
  const [customType, setCustomType] = useState('')
  const [date, setDate] = useState(TODAY)
  const [duration, setDuration] = useState('')
  const [distance, setDistance] = useState('')
  const [level, setLevel] = useState('')
  const [avgHr, setAvgHr] = useState('')
  const [calories, setCalories] = useState('')
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isCardio = CARDIO_TYPES.has(sessionType)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    const type = sessionType === 'Other' ? customType.trim() : sessionType
    if (!type) return

    setSubmitting(true)
    try {
      const supabase = createClient()

      let photoUrl: string | null = null
      if (photoFile) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const ext = photoFile.name.split('.').pop() || 'jpg'
          const path = `${user.id}/${Date.now()}.${ext}`
          const { error } = await supabase.storage
            .from('workout-photos')
            .upload(path, photoFile, { contentType: photoFile.type, upsert: false })
          if (!error) {
            const { data: urlData } = supabase.storage
              .from('workout-photos')
              .getPublicUrl(path)
            photoUrl = urlData.publicUrl
          }
        }
      }

      const body: Record<string, unknown> = {
        date,
        session_type: type.toLowerCase().replace(/\s+/g, '_'),
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      }
      if (duration) body.duration_min = parseInt(duration, 10)
      if (notes.trim()) body.notes = notes.trim()
      if (photoUrl) body.photo_url = photoUrl

      const res = await fetch('/api/training/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const session = await res.json()

      if (session?.id && isCardio && (distance || level || avgHr || calories)) {
        const cardioNoteParts = [
          level && `Level ${level}`,
          avgHr && `${avgHr}bpm avg`,
          calories && `${calories}cal`,
        ].filter(Boolean)

        await fetch('/api/training/exercise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: session.id,
            name: type,
            set_number: 1,
            set_type: 'working',
            duration_sec: duration ? parseInt(duration, 10) * 60 : undefined,
            distance_m: distance ? Math.round(parseFloat(distance) * 1000) : undefined,
            notes: cardioNoteParts.length > 0 ? cardioNoteParts.join(' · ') : undefined,
          }),
        })
      }

      setDone(true)
      setTimeout(() => { onLogged(); onClose() }, 1000)
    } finally {
      setSubmitting(false)
    }
  }

  const displayType = sessionType === 'Other' ? customType : sessionType
  const canSubmit = !submitting && !done && (sessionType && (sessionType !== 'Other' || customType.trim()))

  const inputStyle: React.CSSProperties = {
    width: '100%', backgroundColor: '#1c1c1e',
    border: '1px solid #2c2c2e', borderRadius: '12px',
    padding: '10px 14px', fontSize: '14px', color: '#fff',
    outline: 'none', boxSizing: 'border-box',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', color: '#52525b', fontWeight: 600,
    marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: '480px',
        backgroundColor: '#111', borderRadius: '24px 24px 0 0',
        border: '1px solid #1c1c1c', borderBottom: 'none',
        padding: '24px 20px 40px',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Log Workout</div>
            <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>Manual entry or screenshot</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: '#1c1c1e', border: '1px solid #2c2c2e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={15} color="#71717a" />
          </button>
        </div>

        {/* Session type chips */}
        <div style={{ marginBottom: '16px' }}>
          <div style={labelStyle}>Workout type</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {SESSION_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setSessionType(t)}
                style={{
                  padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  backgroundColor: sessionType === t ? '#c8a97e' : '#1c1c1e',
                  color: sessionType === t ? '#000' : '#a1a1aa',
                  border: sessionType === t ? '1px solid #c8a97e' : '1px solid #2c2c2e',
                }}
              >
                {t}
              </button>
            ))}
          </div>
          {sessionType === 'Other' && (
            <input
              autoFocus
              value={customType}
              onChange={e => setCustomType(e.target.value)}
              placeholder="e.g. Martial Arts, Dance…"
              style={{ ...inputStyle, marginTop: '10px' }}
            />
          )}
        </div>

        {/* Date */}
        <div style={{ marginBottom: '16px' }}>
          <div style={labelStyle}>Date</div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              onClick={() => setDate(TODAY)}
              style={{
                padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', flexShrink: 0,
                backgroundColor: date === TODAY ? '#c8a97e22' : '#1c1c1e',
                color: date === TODAY ? '#c8a97e' : '#71717a',
                border: date === TODAY ? '1px solid #c8a97e55' : '1px solid #2c2c2e',
              }}
            >
              Today
            </button>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="date"
                value={date}
                max={TODAY}
                onChange={e => setDate(e.target.value)}
                style={{
                  ...inputStyle,
                  colorScheme: 'dark',
                  cursor: 'pointer',
                  color: date !== TODAY ? '#c8a97e' : '#52525b',
                }}
              />
            </div>
            {date !== TODAY && (
              <div style={{ fontSize: '12px', color: '#c8a97e', fontWeight: 600, flexShrink: 0 }}>
                {formatDateLabel(date)}
              </div>
            )}
          </div>
        </div>

        {/* Duration */}
        <div style={{ marginBottom: '16px' }}>
          <div style={labelStyle}>Duration (optional)</div>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="45"
              min={1}
              max={600}
              style={{ ...inputStyle, paddingRight: '40px' }}
            />
            <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#52525b' }}>min</span>
          </div>
        </div>

        {/* Cardio-specific fields */}
        {isCardio && (
          <div style={{ marginBottom: '16px', backgroundColor: '#0f0f0f', border: '1px solid #1c1c1c', borderRadius: '14px', padding: '14px' }}>
            <div style={{ fontSize: '11px', color: '#f97316', fontWeight: 700, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cardio Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {/* Distance */}
              <div>
                <div style={{ ...labelStyle, marginBottom: '6px' }}>Distance</div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={distance}
                    onChange={e => setDistance(e.target.value)}
                    placeholder="5.0"
                    step="0.1"
                    min={0}
                    style={{ ...inputStyle, paddingRight: '32px', fontSize: '13px' }}
                  />
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#52525b' }}>km</span>
                </div>
              </div>

              {/* Level / Intensity */}
              <div>
                <div style={{ ...labelStyle, marginBottom: '6px' }}>
                  {sessionType === 'Running' ? 'Pace (min/km)' : 'Level / Intensity'}
                </div>
                <input
                  type={sessionType === 'Running' ? 'text' : 'number'}
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  placeholder={sessionType === 'Running' ? "5:30" : "12"}
                  min={1}
                  style={{ ...inputStyle, fontSize: '13px' }}
                />
              </div>

              {/* Avg HR */}
              <div>
                <div style={{ ...labelStyle, marginBottom: '6px' }}>Avg Heart Rate</div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={avgHr}
                    onChange={e => setAvgHr(e.target.value)}
                    placeholder="145"
                    min={40}
                    max={220}
                    style={{ ...inputStyle, paddingRight: '40px', fontSize: '13px' }}
                  />
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#52525b' }}>bpm</span>
                </div>
              </div>

              {/* Calories */}
              <div>
                <div style={{ ...labelStyle, marginBottom: '6px' }}>Calories</div>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    value={calories}
                    onChange={e => setCalories(e.target.value)}
                    placeholder="350"
                    min={0}
                    style={{ ...inputStyle, paddingRight: '32px', fontSize: '13px' }}
                  />
                  <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#52525b' }}>cal</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: '16px' }}>
          <div style={labelStyle}>Notes (optional)</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={isCardio ? "How did it feel? Zones, effort level, etc." : "What did you do? PR, felt strong, etc."}
            rows={3}
            style={{
              ...inputStyle,
              resize: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Photo upload */}
        <div style={{ marginBottom: '24px' }}>
          <div style={labelStyle}>Screenshot / Photo (optional)</div>

          {photoPreview ? (
            <div style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Workout preview"
                style={{ width: '100%', borderRadius: '12px', maxHeight: '220px', objectFit: 'cover', border: '1px solid #2c2c2e' }}
              />
              <button
                onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                style={{
                  position: 'absolute', top: '8px', right: '8px',
                  width: '28px', height: '28px', borderRadius: '50%',
                  backgroundColor: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={13} color="#fff" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '20px',
                backgroundColor: '#1c1c1e', border: '1.5px dashed #2c2c2e',
                borderRadius: '12px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#c8a97e44')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#2c2c2e')}
            >
              <div style={{ display: 'flex', gap: '10px' }}>
                <Camera size={18} color="#52525b" />
                <Upload size={18} color="#52525b" />
              </div>
              <span style={{ fontSize: '13px', color: '#52525b' }}>Tap to attach a screenshot or photo</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '14px',
            borderRadius: '14px', fontSize: '15px', fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            border: 'none', transition: 'opacity 0.15s',
            backgroundColor: done ? '#22c55e' : '#c8a97e',
            color: done ? '#fff' : '#000',
            opacity: canSubmit || done ? 1 : 0.4,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          }}
        >
          {done ? (
            <><CheckCircle2 size={17} /> Logged!</>
          ) : submitting ? (
            <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
          ) : (
            <>
              Log {displayType || 'Workout'}
              {date !== TODAY && <span style={{ fontSize: '12px', opacity: 0.7 }}> · {formatDateLabel(date)}</span>}
            </>
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

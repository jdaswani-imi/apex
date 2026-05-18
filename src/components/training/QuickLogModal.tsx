'use client'

import { useRef, useState } from 'react'
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

interface Props {
  onClose: () => void
  onLogged: () => void
}

export default function QuickLogModal({ onClose, onLogged }: Props) {
  const [sessionType, setSessionType] = useState('')
  const [customType, setCustomType] = useState('')
  const [duration, setDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        date: new Date().toISOString().split('T')[0],
        session_type: type.toLowerCase().replace(/\s+/g, '_'),
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      }
      if (duration) body.duration_min = parseInt(duration, 10)
      if (notes.trim()) body.notes = notes.trim()
      if (photoUrl) body.photo_url = photoUrl

      await fetch('/api/training/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      setDone(true)
      setTimeout(() => { onLogged(); onClose() }, 1000)
    } finally {
      setSubmitting(false)
    }
  }

  const displayType = sessionType === 'Other' ? customType : sessionType
  const canSubmit = !submitting && !done && (sessionType && (sessionType !== 'Other' || customType.trim()))

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
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Log Custom Workout</div>
            <div style={{ fontSize: '12px', color: '#52525b', marginTop: '2px' }}>Screenshot or manual entry</div>
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
          <div style={{ fontSize: '11px', color: '#52525b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Workout type</div>
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
              style={{
                marginTop: '10px', width: '100%', backgroundColor: '#1c1c1e',
                border: '1px solid #2c2c2e', borderRadius: '12px',
                padding: '10px 14px', fontSize: '14px', color: '#fff',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        {/* Duration */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#52525b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration (optional)</div>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="45"
              min={1}
              max={600}
              style={{
                width: '100%', backgroundColor: '#1c1c1e',
                border: '1px solid #2c2c2e', borderRadius: '12px',
                padding: '10px 40px 10px 14px', fontSize: '14px', color: '#fff',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#52525b' }}>min</span>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#52525b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes (optional)</div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="What did you do? PR, felt strong, etc."
            rows={3}
            style={{
              width: '100%', backgroundColor: '#1c1c1e',
              border: '1px solid #2c2c2e', borderRadius: '12px',
              padding: '10px 14px', fontSize: '14px', color: '#fff',
              outline: 'none', resize: 'none', boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Photo upload */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', color: '#52525b', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Screenshot / Photo (optional)</div>

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
            `Log ${displayType || 'Workout'}`
          )}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

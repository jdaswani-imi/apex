'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Footprints, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface StepsCardProps {
  date: string
  initialSteps: number | null
  stepsTarget: number
  isToday: boolean
}

export function StepsCard({ date, initialSteps, stepsTarget, isToday }: StepsCardProps) {
  const [steps, setSteps] = useState<number | null>(initialSteps)
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const pct = steps !== null ? Math.min(100, Math.round((steps / stepsTarget) * 100)) : 0
  const hitTarget = steps !== null && steps >= stepsTarget
  const color = hitTarget ? 'text-green-400' : 'text-blue-400'
  const barColor = hitTarget ? 'bg-green-400' : 'bg-blue-400'

  const startEdit = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault()
    setInputVal(steps !== null ? String(steps) : '')
    setEditing(true)
  }, [steps])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const cancel = useCallback(() => {
    setEditing(false)
    setInputVal('')
  }, [])

  const save = useCallback(async () => {
    const parsed = parseInt(inputVal, 10)
    if (isNaN(parsed) || parsed < 0) { cancel(); return }
    setSaving(true)
    try {
      const res = await fetch('/api/daily-log/steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, steps: parsed }),
      })
      if (res.ok) {
        setSteps(parsed)
        setEditing(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }, [inputVal, date, cancel, router])

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') cancel()
  }, [save, cancel])

  const weekHref = isToday ? '/week' : `/week?date=${date}`

  return (
    <div className="bg-card border border-border rounded-2xl p-4 transition-all duration-200 hover:border-white/15">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <Link
          href={weekHref}
          className="text-muted-foreground text-xs font-bold uppercase tracking-widest hover:text-foreground transition-colors"
          onClick={e => e.stopPropagation()}
        >
          Steps
        </Link>
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Footprints size={14} className={color} />
        </div>
      </div>

      {editing ? (
        /* ── Edit mode ── */
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="number"
            min="0"
            max="99999"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full bg-white/5 border border-blue-400/40 rounded-lg px-2 py-1.5 font-condensed text-2xl font-bold text-foreground focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="e.g. 8500"
          />
          <div className="flex gap-1.5">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/30 transition-all disabled:opacity-50"
            >
              <Check size={11} />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={cancel}
              className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-white/5 text-muted-foreground text-xs font-semibold hover:bg-white/10 transition-all"
            >
              <X size={11} />
              Cancel
            </button>
          </div>
        </div>
      ) : steps !== null ? (
        /* ── Has data ── */
        <button onClick={startEdit} className="w-full text-left">
          <p className={cn('font-condensed text-3xl font-bold leading-none', color)}>
            {steps.toLocaleString()}
          </p>
          <div className="mt-2">
            <div className="w-full bg-white/5 rounded-full h-1">
              <div
                className={cn('h-1 rounded-full transition-all duration-500', barColor)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-muted-foreground text-[10px] mt-1.5">
              {pct}% of {stepsTarget.toLocaleString()}
            </p>
          </div>
        </button>
      ) : (
        /* ── Empty state ── */
        <button
          onClick={startEdit}
          className="w-full text-left group"
        >
          <p className="font-condensed text-3xl font-bold leading-none text-muted-foreground/30">
            —
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-blue-400/70 group-hover:text-blue-400 transition-colors">
              + Log steps
            </span>
            <span className="text-[10px] text-muted-foreground/40">
              · target {stepsTarget.toLocaleString()}
            </span>
          </div>
        </button>
      )}
    </div>
  )
}

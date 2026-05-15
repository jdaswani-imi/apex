'use client'

import { useState, useTransition } from 'react'
import { Activity, Moon, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'

const RECOVERY_OPTIONS = [
  { value: 1, emoji: '💀', label: 'Wrecked' },
  { value: 2, emoji: '😩', label: 'Poor' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '💪', label: 'Peak' },
]

const SLEEP_OPTIONS = [
  { value: 1, emoji: '😩', label: 'Terrible' },
  { value: 2, emoji: '😕', label: 'Poor' },
  { value: 3, emoji: '😐', label: 'Fair' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😴', label: 'Great' },
]

const STRAIN_OPTIONS = [
  { value: 1, emoji: '🛋️', label: 'Rest' },
  { value: 2, emoji: '🚶', label: 'Light' },
  { value: 3, emoji: '🏃', label: 'Moderate' },
  { value: 4, emoji: '💪', label: 'Hard' },
  { value: 5, emoji: '🔥', label: 'All out' },
]

// Maps qualitative 1-5 to approximate WHOOP-equivalent % for display
const recoveryPct = [20, 35, 50, 67, 85]
const strainVal = [3, 7, 12, 16, 19]

interface Props {
  initialRecovery: number | null
  initialSleepQuality: number | null
  initialSleepHours: number | null
  initialStrain: number | null
}

function EmojiPicker({
  options,
  value,
  onChange,
}: {
  options: { value: number; emoji: string; label: string }[]
  value: number | null
  onChange: (v: number) => void
}) {
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-xl transition-all duration-150',
            value === opt.value
              ? 'bg-violet-500/25 ring-1 ring-violet-500/60'
              : 'bg-white/5 hover:bg-white/10',
          )}
          title={opt.label}
        >
          <span>{opt.emoji}</span>
          <span className="text-[9px] text-zinc-500 leading-none">{opt.label}</span>
        </button>
      ))}
    </div>
  )
}

export function QualitativeCheckin({
  initialRecovery,
  initialSleepQuality,
  initialSleepHours,
  initialStrain,
}: Props) {
  const hasData = initialRecovery !== null || initialSleepQuality !== null || initialSleepHours !== null || initialStrain !== null

  const [editing, setEditing] = useState(!hasData)
  const [recovery, setRecovery] = useState<number | null>(initialRecovery)
  const [sleepQuality, setSleepQuality] = useState<number | null>(initialSleepQuality)
  const [sleepHours, setSleepHours] = useState<number | null>(initialSleepHours)
  const [strain, setStrain] = useState<number | null>(initialStrain)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(hasData)

  function adjustHours(delta: number) {
    setSleepHours(prev => {
      const next = Math.round(((prev ?? 7) + delta) * 2) / 2
      return Math.max(0, Math.min(24, next))
    })
  }

  function handleSave() {
    startTransition(async () => {
      await fetch('/api/feelings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feeling_recovery: recovery,
          feeling_sleep_quality: sleepQuality,
          feeling_sleep_hours: sleepHours,
          feeling_strain: strain,
        }),
      })
      setSaved(true)
      setEditing(false)
    })
  }

  // ── Display mode ──────────────────────────────────────────────────────────
  if (saved && !editing) {
    const recOpt = recovery !== null ? RECOVERY_OPTIONS[recovery - 1] : null
    const sleepOpt = sleepQuality !== null ? SLEEP_OPTIONS[sleepQuality - 1] : null
    const strainOpt = strain !== null ? STRAIN_OPTIONS[strain - 1] : null

    return (
      <>
        {/* Recovery-equivalent vitals */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity size={13} className="text-violet-400" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">How You Feel · Today</span>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <Pencil size={12} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {recOpt && (
              <div>
                <p className="text-violet-400 font-bold text-2xl leading-none">
                  {recoveryPct[recovery! - 1]}%
                </p>
                <p className="text-zinc-600 text-[10px] mt-1">
                  Recovery · {recOpt.label}
                </p>
              </div>
            )}
            {strainOpt && (
              <div>
                <p className={cn('font-bold text-2xl leading-none',
                  strain! >= 5 ? 'text-red-400' :
                  strain! >= 4 ? 'text-orange-400' :
                  strain! >= 3 ? 'text-yellow-400' : 'text-green-400'
                )}>
                  {strainVal[strain! - 1].toFixed(1)}
                </p>
                <p className="text-zinc-600 text-[10px] mt-1">
                  Strain · {strainOpt.label}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sleep-equivalent */}
        {(sleepOpt || sleepHours !== null) && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Moon size={13} className="text-indigo-400" />
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Last Night&apos;s Sleep</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4">
              {sleepHours !== null && (
                <div>
                  <p className="text-foreground font-bold text-2xl leading-none">{sleepHours}h</p>
                  <p className="text-zinc-600 text-[10px] mt-1">Duration</p>
                </div>
              )}
              {sleepOpt && (
                <div>
                  <p className="text-foreground font-bold text-lg leading-none">{sleepOpt.label}</p>
                  <p className="text-zinc-600 text-[10px] mt-1">Sleep quality</p>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    )
  }

  // ── Input form ────────────────────────────────────────────────────────────
  return (
    <div className="bg-card border border-violet-500/20 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Activity size={13} className="text-violet-400" />
        <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">
          No Whoop connected · How are you feeling?
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-zinc-500 text-xs font-medium">Recovery</p>
        <EmojiPicker options={RECOVERY_OPTIONS} value={recovery} onChange={setRecovery} />
      </div>

      <div className="space-y-1">
        <p className="text-zinc-500 text-xs font-medium">Sleep quality</p>
        <EmojiPicker options={SLEEP_OPTIONS} value={sleepQuality} onChange={setSleepQuality} />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-zinc-500 text-xs font-medium">Hours slept</p>
          <span className="text-white text-sm font-semibold">
            {sleepHours !== null ? `${sleepHours}h` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => adjustHours(-0.5)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-lg flex items-center justify-center transition-colors"
          >
            −
          </button>
          <div className="flex-1 bg-white/5 rounded-xl h-9 flex items-center px-3">
            <div
              className="h-1 bg-violet-500/60 rounded-full transition-all duration-200"
              style={{ width: sleepHours !== null ? `${Math.min(100, (sleepHours / 10) * 100)}%` : '0%' }}
            />
          </div>
          <button
            type="button"
            onClick={() => adjustHours(0.5)}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-lg flex items-center justify-center transition-colors"
          >
            +
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-zinc-500 text-xs font-medium">Today&apos;s exertion</p>
        <EmojiPicker options={STRAIN_OPTIONS} value={strain} onChange={setStrain} />
      </div>

      <button
        onClick={handleSave}
        disabled={isPending}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm transition-colors"
      >
        {isPending ? 'Saving…' : 'Save check-in'}
      </button>
    </div>
  )
}

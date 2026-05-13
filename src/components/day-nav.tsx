'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  date: string
  todayStr: string
}

function formatLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Today'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export function DayNav({ date, todayStr }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localDate, setLocalDate] = useState(date)

  // Keep in sync if server sends a corrected date
  if (localDate !== date && !isPending) {
    setLocalDate(date)
  }

  const isToday = localDate === todayStr
  const label = formatLabel(localDate, todayStr)

  function navigate(delta: number) {
    const d = new Date(localDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const next = d.toISOString().split('T')[0]
    if (next > todayStr) return
    // Update label immediately, then kick off server navigation
    setLocalDate(next)
    startTransition(() => {
      router.push(next === todayStr ? '/' : `/?date=${next}`)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => navigate(-1)}
        disabled={isPending}
        className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
        aria-label="Previous day"
      >
        <ChevronLeft size={16} />
      </button>
      <span className={cn(
        'text-sm font-semibold min-w-[100px] text-center transition-colors duration-150',
        isToday ? 'text-orange-400' : isPending ? 'text-zinc-500' : 'text-zinc-300'
      )}>
        {label}
      </span>
      <button
        onClick={() => navigate(1)}
        disabled={isToday || isPending}
        aria-label="Next day"
        className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95',
          isToday || isPending
            ? 'text-zinc-800 cursor-not-allowed'
            : 'text-zinc-500 bg-white/5 hover:text-white hover:bg-white/10'
        )}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

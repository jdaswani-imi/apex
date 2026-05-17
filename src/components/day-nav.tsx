'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  date: string
  todayStr: string
  basePath?: string
}

const MAX_FUTURE_DAYS = 7

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function formatLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return 'Today'
  const tomorrowStr = addDays(todayStr, 1)
  if (dateStr === tomorrowStr) return 'Tomorrow'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export function DayNav({ date, todayStr, basePath = '/' }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [localDate, setLocalDate] = useState(date)

  // Keep in sync if server sends a corrected date
  if (localDate !== date && !isPending) {
    setLocalDate(date)
  }

  const maxDate = addDays(todayStr, MAX_FUTURE_DAYS)
  const isToday = localDate === todayStr
  const isMaxFuture = localDate >= maxDate
  const label = formatLabel(localDate, todayStr)

  function navigate(delta: number) {
    const next = addDays(localDate, delta)
    if (next > maxDate) return
    setLocalDate(next)
    startTransition(() => {
      router.push(next === todayStr ? basePath : `${basePath}?date=${next}`)
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
        isToday ? 'text-orange-400' : localDate > todayStr ? 'text-sky-400' : isPending ? 'text-zinc-500' : 'text-zinc-300'
      )}>
        {label}
      </span>
      <button
        onClick={() => navigate(1)}
        disabled={isMaxFuture || isPending}
        aria-label="Next day"
        className={cn(
          'w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95',
          isMaxFuture || isPending
            ? 'text-zinc-800 cursor-not-allowed'
            : 'text-zinc-500 bg-white/5 hover:text-white hover:bg-white/10'
        )}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

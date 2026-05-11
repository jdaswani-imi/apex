import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getRecoveryColor(score: number): string {
  if (score >= 67) return 'text-green-400'
  if (score >= 34) return 'text-yellow-400'
  return 'text-red-400'
}

export function getRecoveryBg(score: number): string {
  if (score >= 67) return 'bg-green-400'
  if (score >= 34) return 'bg-yellow-400'
  return 'bg-red-400'
}

export function getRecoveryLabel(score: number): string {
  if (score >= 67) return 'Green'
  if (score >= 34) return 'Yellow'
  return 'Red'
}

export function getDaysToTomorrowland(): number {
  const target = new Date('2026-07-24')
  const today = new Date()
  const diff = target.getTime() - today.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getTrainingDayType(date: Date): string {
  const day = date.getDay()
  const types: Record<number, string> = {
    0: 'Upper Pull / Rest',
    1: 'Upper Push',
    2: 'Cricket / Legs',
    3: 'Lower Body / Zone 2',
    4: 'Upper Pull',
    5: 'Cardio / Stairmaster',
    6: 'Arms & Abs (Optional)',
  }
  return types[day]
}

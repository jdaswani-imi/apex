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

export function getDaysToEvent(fromDate: string | undefined, targetDate: string): number {
  const target = new Date(targetDate + 'T12:00:00')
  const from = fromDate ? new Date(fromDate + 'T12:00:00') : new Date()
  const diff = target.getTime() - from.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getTrainingDayType(date: Date, trainingSplit: Record<string, string>): string {
  const day = date.getDay()
  return trainingSplit[String(day)] ?? 'Rest'
}

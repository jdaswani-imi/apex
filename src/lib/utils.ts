import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { todayLocal } from "./date"

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
  // Anchor both ends to noon so the result depends only on the calendar gap,
  // not on the time of day the call happens to run (which flipped N vs N-1).
  const target = new Date(targetDate + 'T12:00:00')
  const from = new Date((fromDate || todayLocal()) + 'T12:00:00')
  const diff = target.getTime() - from.getTime()
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

export function getTrainingDayType(date: Date, trainingSplit: Record<string, string>): string {
  const day = date.getDay()
  return trainingSplit[String(day)] ?? 'Rest'
}

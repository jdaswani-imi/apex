'use client'

import React, { useState, useEffect } from 'react'
import { Heart, Moon, Zap, Activity, Droplets, Thermometer, Wind, Dumbbell, RefreshCw } from 'lucide-react'
import type { WhoopRecovery, WhoopSleep, WhoopCycle, WhoopWorkout } from '@/lib/types'

type Tab = 'recovery' | 'sleep' | 'strain'

interface WhoopData {
  recovery: WhoopRecovery[]
  sleep: WhoopSleep[]
  cycles: WhoopCycle[]
  workouts: WhoopWorkout[]
}

function recoveryColor(score: number | null) {
  if (score === null) return 'var(--muted-foreground)'
  if (score >= 67) return '#4ade80'
  if (score >= 34) return '#facc15'
  return '#f87171'
}

function recoveryBg(score: number | null) {
  if (score === null) return 'var(--muted)'
  if (score >= 67) return 'rgba(74,222,128,0.12)'
  if (score >= 34) return 'rgba(250,204,21,0.12)'
  return 'rgba(248,113,113,0.12)'
}

function strainColor(strain: number | null) {
  if (strain === null) return 'var(--muted-foreground)'
  if (strain >= 18) return '#f87171'
  if (strain >= 14) return '#fb923c'
  if (strain >= 10) return '#facc15'
  return '#4ade80'
}

function fmtDuration(hrs: number | null) {
  if (hrs === null) return '—'
  const h = Math.floor(hrs)
  const m = Math.round((hrs - h) * 60)
  return `${h}h ${m}m`
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const scale = Math.min(1, value / max)
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{
        width: '100%', height: '48px',
        backgroundColor: 'var(--muted)',
        borderRadius: '4px',
        display: 'flex', alignItems: 'flex-end', overflow: 'hidden',
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: color,
          borderRadius: '3px 3px 0 0',
          transform: `scaleY(${scale})`,
          transformOrigin: 'bottom',
          transition: 'transform 0.5s ease',
        }} />
      </div>
    </div>
  )
}

function StatPill({ label, value, unit, icon: Icon, color, bg }: {
  label: string
  value: string | number | null
  unit?: string
  icon: React.ElementType
  color: string
  bg: string
}) {
  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-2" style={{ backgroundColor: bg }}>
      <div className="flex items-center gap-1.5">
        <Icon size={13} style={{ color }} />
        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-[26px] font-bold leading-none${value === null ? ' text-muted-foreground' : ''}`}
          style={value !== null ? { color } : undefined}
        >
          {value ?? '—'}
        </span>
        {unit && value !== null && (
          <span className="text-xs text-muted-foreground font-medium">{unit}</span>
        )}
      </div>
    </div>
  )
}

function SleepStageBar({ deep, rem, light, awake }: {
  deep: number | null; rem: number | null; light: number | null; awake: number | null
}) {
  const total = (deep ?? 0) + (rem ?? 0) + (light ?? 0) + (awake ?? 0)
  if (total === 0) return null
  const pct = (v: number | null) => Math.round(((v ?? 0) / total) * 100)
  const stages = [
    { label: 'Deep', value: deep, pct: pct(deep), color: '#6366f1' },
    { label: 'REM', value: rem, pct: pct(rem), color: '#8b5cf6' },
    { label: 'Light', value: light, pct: pct(light), color: '#60a5fa' },
    { label: 'Awake', value: awake, pct: pct(awake), color: '#374151' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', borderRadius: '6px', overflow: 'hidden', height: '10px' }}>
        {stages.map(s => s.pct > 0 && (
          <div key={s.label} style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {stages.slice(0, 3).map(s => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: s.color }} />
            <span style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{s.label}</span>
            <span style={{ fontSize: '11px', color: 'var(--foreground)', fontWeight: 600 }}>{s.value ?? 0}m</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecoveryTab({ data }: { data: WhoopData }) {
  const records = [...data.recovery].reverse().slice(-14)
  const latest = data.recovery[0] ?? null
  const avgHrv = records.length > 0
    ? Math.round(records.reduce((s, r) => s + (r.hrv_rmssd_milli ?? 0), 0) / records.filter(r => r.hrv_rmssd_milli !== null).length)
    : null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Today's key metrics */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatPill
          label="Recovery"
          value={latest?.recovery_score ?? null}
          unit="%"
          icon={Zap}
          color={recoveryColor(latest?.recovery_score ?? null)}
          bg={recoveryBg(latest?.recovery_score ?? null)}
        />
        <StatPill
          label="HRV"
          value={latest?.hrv_rmssd_milli ? Math.round(latest.hrv_rmssd_milli) : null}
          unit="ms"
          icon={Activity}
          color="#60a5fa"
          bg="rgba(96,165,250,0.1)"
        />
        <StatPill
          label="Resting HR"
          value={latest?.resting_heart_rate ?? null}
          unit="bpm"
          icon={Heart}
          color="#f87171"
          bg="rgba(248,113,113,0.1)"
        />
        <StatPill
          label="SpO₂"
          value={latest?.spo2_percentage ? `${latest.spo2_percentage}` : null}
          unit="%"
          icon={Droplets}
          color="#38bdf8"
          bg="rgba(56,189,248,0.1)"
        />
      </div>

      {/* Skin temp */}
      {latest?.skin_temp_celsius !== null && latest?.skin_temp_celsius !== undefined && (
        <div style={{
          backgroundColor: 'rgba(251,146,60,0.08)',
          borderRadius: '14px',
          padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Thermometer size={14} color="#fb923c" />
            <span style={{ fontSize: '12px', color: 'var(--muted-foreground)', fontWeight: 600 }}>Skin Temperature</span>
          </div>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#fb923c' }}>
            {latest.skin_temp_celsius.toFixed(1)}°C
          </span>
        </div>
      )}

      {/* 14-day recovery trend */}
      {records.length > 1 && (
        <div style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          padding: '16px',
        }}>
          <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
            14-Day Recovery Trend
          </p>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '64px' }}>
            {records.map((r, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%' }}>
                <MiniBar
                  value={r.recovery_score ?? 0}
                  max={100}
                  color={recoveryColor(r.recovery_score)}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontSize: '9px', color: 'var(--muted-foreground)' }}>{records.length > 0 ? fmtDate(records[0].date) : ''}</span>
            <span style={{ fontSize: '9px', color: 'var(--muted-foreground)' }}>{records.length > 0 ? fmtDate(records[records.length - 1].date) : ''}</span>
          </div>
        </div>
      )}

      {/* HRV trend */}
      {records.filter(r => r.hrv_rmssd_milli !== null).length > 1 && (
        <div style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              HRV Trend
            </p>
            {avgHrv && (
              <span style={{ fontSize: '11px', color: 'var(--foreground)', fontWeight: 700 }}>avg {avgHrv}ms</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '48px' }}>
            {records.map((r, i) => {
              const maxHrv = Math.max(...records.map(x => x.hrv_rmssd_milli ?? 0), 1)
              return (
                <div key={i} style={{ flex: 1, height: '100%' }}>
                  <MiniBar value={r.hrv_rmssd_milli ?? 0} max={maxHrv} color="#60a5fa" />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent records */}
      <div style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '18px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px 10px' }}>
          <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Recent
          </p>
        </div>
        {data.recovery.slice(0, 7).map((r, i) => (
          <div key={r.id} style={{
            padding: '10px 16px',
            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              backgroundColor: recoveryBg(r.recovery_score),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: recoveryColor(r.recovery_score) }}>
                {r.recovery_score ?? '—'}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', color: 'var(--foreground)', fontWeight: 500 }}>{fmtDate(r.date)}</p>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                {r.hrv_rmssd_milli ? `HRV ${Math.round(r.hrv_rmssd_milli)}ms` : ''}
                {r.hrv_rmssd_milli && r.resting_heart_rate ? ' · ' : ''}
                {r.resting_heart_rate ? `RHR ${r.resting_heart_rate}bpm` : ''}
              </p>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
              {r.spo2_percentage ? `${r.spo2_percentage}%` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SleepTab({ data }: { data: WhoopData }) {
  const records = [...data.sleep].reverse().slice(-14)
  const latest = data.sleep[0] ?? null
  const maxDur = Math.max(...records.map(r => r.duration_hrs ?? 0), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatPill
          label="Duration"
          value={latest?.duration_hrs ? `${latest.duration_hrs.toFixed(1)}` : null}
          unit="hrs"
          icon={Moon}
          color="#60a5fa"
          bg="rgba(96,165,250,0.1)"
        />
        <StatPill
          label="Performance"
          value={latest?.sleep_performance_pct ?? null}
          unit="%"
          icon={Zap}
          color="#34d399"
          bg="rgba(52,211,153,0.1)"
        />
        <StatPill
          label="Efficiency"
          value={latest?.sleep_efficiency_pct ?? null}
          unit="%"
          icon={Activity}
          color="#60a5fa"
          bg="rgba(96,165,250,0.1)"
        />
        <StatPill
          label="Resp. Rate"
          value={latest?.respiratory_rate ? `${latest.respiratory_rate.toFixed(1)}` : null}
          unit="/min"
          icon={Wind}
          color="#fb923c"
          bg="rgba(251,146,60,0.1)"
        />
      </div>

      {/* Sleep stages for last night */}
      {latest && (
        <div style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Sleep Stages
            </p>
            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>
              {fmtTime(latest.start_time)} → {fmtTime(latest.end_time)}
            </div>
          </div>
          <SleepStageBar
            deep={latest.deep_sleep_min}
            rem={latest.rem_min}
            light={latest.light_sleep_min}
            awake={latest.awake_min}
          />
        </div>
      )}

      {/* 14-day sleep duration trend */}
      {records.length > 1 && (
        <div style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          padding: '16px',
        }}>
          <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
            Sleep Duration Trend
          </p>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '64px' }}>
            {records.map((r, i) => (
              <div key={i} style={{ flex: 1, height: '100%' }}>
                <MiniBar value={r.duration_hrs ?? 0} max={Math.max(maxDur, 9)} color="#60a5fa" />
              </div>
            ))}
          </div>
          <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.06)', position: 'relative' }}>
              <span style={{
                position: 'absolute', right: 0, top: '-14px',
                fontSize: '9px', color: 'var(--muted-foreground)',
              }}>8h target</span>
            </div>
          </div>
        </div>
      )}

      {/* Recent records */}
      <div style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '18px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px 10px' }}>
          <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Recent Nights
          </p>
        </div>
        {data.sleep.slice(0, 7).map((s, i) => (
          <div key={s.id} style={{
            padding: '10px 16px',
            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              backgroundColor: 'rgba(96,165,250,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Moon size={15} color="#60a5fa" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', color: 'var(--foreground)', fontWeight: 500 }}>{fmtDate(s.date)}</p>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                {s.duration_hrs ? fmtDuration(s.duration_hrs) : '—'}
                {s.deep_sleep_min ? ` · Deep ${s.deep_sleep_min}m` : ''}
                {s.rem_min ? ` · REM ${s.rem_min}m` : ''}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: s.sleep_performance_pct && s.sleep_performance_pct >= 70 ? '#34d399' : s.sleep_performance_pct && s.sleep_performance_pct >= 50 ? '#facc15' : '#f87171' }}>
                {s.sleep_performance_pct ? `${s.sleep_performance_pct}%` : '—'}
              </p>
              <p style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>perf</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StrainTab({ data }: { data: WhoopData }) {
  const records = [...data.cycles].reverse().slice(-14)
  const latest = data.cycles[0] ?? null
  const maxStrain = Math.max(...records.map(r => r.strain ?? 0), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Today's strain */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatPill
          label="Day Strain"
          value={latest?.strain ? latest.strain.toFixed(1) : null}
          icon={Zap}
          color={strainColor(latest?.strain ?? null)}
          bg={`rgba(${latest?.strain && latest.strain >= 18 ? '248,113,113' : latest?.strain && latest.strain >= 14 ? '251,146,60' : latest?.strain && latest.strain >= 10 ? '250,204,21' : '74,222,128'},0.1)`}
        />
        <StatPill
          label="Avg Heart Rate"
          value={latest?.avg_heart_rate ?? null}
          unit="bpm"
          icon={Heart}
          color="#f87171"
          bg="rgba(248,113,113,0.1)"
        />
        <StatPill
          label="Max Heart Rate"
          value={latest?.max_heart_rate ?? null}
          unit="bpm"
          icon={Activity}
          color="#fb923c"
          bg="rgba(251,146,60,0.1)"
        />
        <StatPill
          label="Calories"
          value={latest?.kilojoule ? Math.round(latest.kilojoule / 4.184) : null}
          unit="kcal"
          icon={Zap}
          color="#facc15"
          bg="rgba(250,204,21,0.1)"
        />
      </div>

      {/* 14-day strain trend */}
      {records.length > 1 && (
        <div style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          padding: '16px',
        }}>
          <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
            Strain Trend
          </p>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '64px' }}>
            {records.map((r, i) => (
              <div key={i} style={{ flex: 1, height: '100%' }}>
                <MiniBar value={r.strain ?? 0} max={Math.max(maxStrain, 21)} color={strainColor(r.strain)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
            <span style={{ fontSize: '9px', color: 'var(--muted-foreground)' }}>{records.length > 0 ? fmtDate(records[0].date) : ''}</span>
            <span style={{ fontSize: '9px', color: 'var(--muted-foreground)' }}>{records.length > 0 ? fmtDate(records[records.length - 1].date) : ''}</span>
          </div>
        </div>
      )}

      {/* Recent workouts */}
      {data.workouts.length > 0 && (
        <div style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 10px' }}>
            <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Workouts
            </p>
          </div>
          {data.workouts.slice(0, 8).map((w, i) => {
            const totalMin = (w.zone_0_min ?? 0) + (w.zone_1_min ?? 0) + (w.zone_2_min ?? 0) +
              (w.zone_3_min ?? 0) + (w.zone_4_min ?? 0) + (w.zone_5_min ?? 0)
            const kcal = w.kilojoule ? Math.round(w.kilojoule / 4.184) : null
            return (
              <div key={w.id} style={{
                padding: '12px 16px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px',
                    backgroundColor: 'rgba(249,115,22,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Dumbbell size={15} color="#f97316" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', color: 'var(--foreground)', fontWeight: 600 }}>
                      {w.sport_name ?? 'Workout'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                      {w.start_time ? new Date(w.start_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—'}
                      {totalMin > 0 ? ` · ${Math.round(totalMin)}min` : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {w.strain !== null && (
                      <p style={{ fontSize: '14px', fontWeight: 700, color: strainColor(w.strain) }}>
                        {w.strain.toFixed(1)}
                      </p>
                    )}
                    {kcal && <p style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>{kcal} kcal</p>}
                  </div>
                </div>

                {/* HR zones bar */}
                {totalMin > 0 && (
                  <div style={{ marginTop: '10px', display: 'flex', gap: '2px', borderRadius: '4px', overflow: 'hidden', height: '6px' }}>
                    {[
                      { min: w.zone_0_min, color: '#374151' },
                      { min: w.zone_1_min, color: '#1d4ed8' },
                      { min: w.zone_2_min, color: '#15803d' },
                      { min: w.zone_3_min, color: '#ca8a04' },
                      { min: w.zone_4_min, color: '#ea580c' },
                      { min: w.zone_5_min, color: '#dc2626' },
                    ].map((z, zi) => {
                      const pct = Math.round(((z.min ?? 0) / totalMin) * 100)
                      return pct > 0 ? (
                        <div key={zi} style={{ width: `${pct}%`, backgroundColor: z.color }} title={`Zone ${zi}: ${z.min}min`} />
                      ) : null
                    })}
                  </div>
                )}
                {totalMin > 0 && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Z1', min: w.zone_1_min, color: '#1d4ed8' },
                      { label: 'Z2', min: w.zone_2_min, color: '#15803d' },
                      { label: 'Z3', min: w.zone_3_min, color: '#ca8a04' },
                      { label: 'Z4', min: w.zone_4_min, color: '#ea580c' },
                      { label: 'Z5', min: w.zone_5_min, color: '#dc2626' },
                    ].filter(z => (z.min ?? 0) > 0).map(z => (
                      <span key={z.label} style={{ fontSize: '10px', color: z.color, fontWeight: 600 }}>
                        {z.label} {z.min}m
                      </span>
                    ))}
                    {w.avg_heart_rate && (
                      <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>avg {w.avg_heart_rate}bpm</span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Daily cycles list */}
      <div style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '18px',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px 10px' }}>
          <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Daily Cycles
          </p>
        </div>
        {data.cycles.slice(0, 7).map((c, i) => (
          <div key={c.id} style={{
            padding: '10px 16px',
            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              backgroundColor: `rgba(${c.strain && c.strain >= 18 ? '248,113,113' : c.strain && c.strain >= 14 ? '251,146,60' : '74,222,128'},0.1)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: strainColor(c.strain) }}>
                {c.strain !== null ? c.strain.toFixed(0) : '—'}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '13px', color: 'var(--foreground)', fontWeight: 500 }}>{fmtDate(c.date)}</p>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                {c.avg_heart_rate ? `avg ${c.avg_heart_rate}bpm` : ''}
                {c.avg_heart_rate && c.max_heart_rate ? ' · ' : ''}
                {c.max_heart_rate ? `max ${c.max_heart_rate}bpm` : ''}
              </p>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
              {c.kilojoule ? `${Math.round(c.kilojoule / 4.184)} kcal` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProgressPage() {
  const [tab, setTab] = useState<Tab>('recovery')
  const [data, setData] = useState<WhoopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [tokenExpired, setTokenExpired] = useState(false)

  useEffect(() => {
    fetchData()
    fetch('/api/whoop/status')
      .then(r => r.json())
      .then(d => { if (d.expired && !d.canRefresh) setTokenExpired(true) })
      .catch(() => {})
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch('/api/whoop/data')
      if (res.ok) {
        const json = await res.json()
        setData(json)
        if (json.recovery?.[0]?.synced_at) {
          setLastSynced(json.recovery[0].synced_at)
        }
      }
    } catch {}
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await fetch('/api/whoop/sync', { method: 'POST' })
      await fetchData()
    } catch {}
    setSyncing(false)
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'recovery', label: 'Recovery', icon: Zap },
    { key: 'sleep', label: 'Sleep', icon: Moon },
    { key: 'strain', label: 'Strain', icon: Activity },
  ]

  const noData = !loading && (!data || (data.recovery.length === 0 && data.sleep.length === 0 && data.cycles.length === 0))

  return (
    <div className="flex flex-col min-h-screen bg-background pb-8">

      {/* Header */}
      <div className="px-4 md:px-6 pt-4 md:pt-6">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div>
            <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Whoop</p>
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--foreground)', lineHeight: 1.1 }}>Progress</h1>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            <RefreshCw size={15} color="#f97316" className={syncing ? 'animate-spin' : ''} />
          </button>
        </div>
        {lastSynced && (
          <p style={{ fontSize: '10px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
            Synced {new Date(lastSynced).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Expired token banner */}
        {tokenExpired && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '14px', padding: '12px 14px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '12px',
          }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#fca5a5' }}>WHOOP session expired</p>
              <p style={{ fontSize: '11px', color: 'var(--muted-foreground)', marginTop: '2px' }}>Reconnect to sync fresh data</p>
            </div>
            <a
              href="/api/whoop/login"
              style={{
                backgroundColor: '#ff6b6b', color: '#0d0c0b', fontWeight: 700,
                fontSize: '12px', padding: '8px 14px', borderRadius: '10px',
                textDecoration: 'none', flexShrink: 0,
              }}
            >
              Reconnect
            </a>
          </div>
        )}

      {/* Tab bar */}
        <div className={`flex gap-1 bg-secondary rounded-xl p-1 mb-5${lastSynced ? '' : ' mt-4'}`}>
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-lg border-none text-[13px] font-semibold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
                tab === key ? 'bg-foreground text-background' : 'bg-transparent text-muted-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6">
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '60px' }}>
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #f97316', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {noData && (
          <div style={{ textAlign: 'center', paddingTop: '60px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '20px',
              backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
            }}>
              <Activity size={28} color="#f97316" />
            </div>
            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--foreground)', marginBottom: '8px' }}>No WHOOP data yet</p>
            <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginBottom: '20px' }}>
              Connect your WHOOP in Settings to start tracking
            </p>
            <button
              onClick={handleSync}
              className="bg-[#f97316] text-[#0d0c0b] font-bold text-sm px-6 py-3 rounded-xl border-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
            >
              Sync Now
            </button>
          </div>
        )}

        {!loading && data && !noData && (
          <>
            {tab === 'recovery' && <RecoveryTab data={data} />}
            {tab === 'sleep' && <SleepTab data={data} />}
            {tab === 'strain' && <StrainTab data={data} />}
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

'use client'

import React, { useState, useRef, useCallback } from 'react'
import { Upload, Trash2, Loader2, AlertCircle, ChevronDown, ChevronUp, FlaskConical, Calendar, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type OverallStatus = 'good' | 'attention' | 'action_required'
type BiomarkerStatus = 'optimal' | 'sufficient' | 'out_of_range'

interface Biomarker {
  panel: string
  name: string
  value: string
  value_numeric: number | null
  unit: string
  reference_range: string
  range_min: number | null
  range_max: number | null
  status: BiomarkerStatus
  note: string
}

// Legacy format: old reports used sections[]
interface LegacySection {
  label: string
  biomarkers: Array<Omit<Biomarker, 'panel'> & { status: 'normal' | 'low' | 'high' | 'critical' | BiomarkerStatus }>
}

interface StructuredData {
  summary: string
  overall_status: OverallStatus
  biomarkers?: Biomarker[]
  sections?: LegacySection[]  // legacy format
  recommendations: string[]
  disclaimer: string
}

interface Report {
  id: string
  filename: string
  report_type: string
  report_date: string | null
  summary: string | null
  structured_data: StructuredData | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Normalise legacy status values to current 3-value system
function normaliseStatus(s: string): BiomarkerStatus {
  if (s === 'optimal' || s === 'normal') return 'optimal'
  if (s === 'sufficient') return 'sufficient'
  return 'out_of_range'
}

// Extract flat biomarker array from either format
function getBiomarkers(sd: StructuredData): Biomarker[] {
  if (sd.biomarkers && sd.biomarkers.length > 0) {
    return sd.biomarkers.map(b => ({ ...b, status: normaliseStatus(b.status) }))
  }
  // Legacy sections format
  if (sd.sections) {
    return sd.sections.flatMap(s =>
      s.biomarkers.map(b => ({
        ...b,
        panel: s.label,
        value_numeric: null,
        range_min: null,
        range_max: null,
        status: normaliseStatus(b.status),
      } as Biomarker))
    )
  }
  return []
}

const STATUS_CFG: Record<BiomarkerStatus, {
  label: string
  badgeClass: string
  cardClass: string
  icon: string
  sectionClass: string
  groupLabel: string
}> = {
  out_of_range: {
    label: 'Out of Range',
    badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/30',
    cardClass: 'border-red-500/30 bg-red-500/[0.05]',
    icon: '!',
    sectionClass: 'text-foreground',
    groupLabel: 'Out of Range',
  },
  sufficient: {
    label: 'Sufficient',
    badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    cardClass: 'border-amber-500/25 bg-amber-500/[0.04]',
    icon: '●',
    sectionClass: 'text-foreground',
    groupLabel: 'Sufficient',
  },
  optimal: {
    label: 'Optimal',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
    cardClass: 'border-emerald-500/20 bg-emerald-500/[0.04]',
    icon: '✓',
    sectionClass: 'text-foreground',
    groupLabel: 'Optimal',
  },
}

const OVERALL_CFG: Record<OverallStatus, { label: string; badgeClass: string; summaryClass: string }> = {
  good:            { label: 'All clear',       badgeClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', summaryClass: 'bg-emerald-500/8 border-emerald-500/20 text-emerald-100/90' },
  attention:       { label: 'Needs attention', badgeClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',     summaryClass: 'bg-amber-500/8 border-amber-500/20 text-amber-100/90' },
  action_required: { label: 'Action required', badgeClass: 'text-red-400 bg-red-500/10 border-red-500/20',           summaryClass: 'bg-red-500/8 border-red-500/20 text-red-100/90' },
}

// ─── Range bar ────────────────────────────────────────────────────────────────

function RangeBar({ value, rangeMin, rangeMax }: { value: number; rangeMin: number; rangeMax: number }) {
  const mid = (rangeMin + rangeMax) / 2
  const halfSpan = (rangeMax - rangeMin) / 2
  if (halfSpan === 0) return null

  // Map value to bar position: optimal zone sits at 35–65%
  // One halfSpan = 15% of bar
  const toBarPct = (v: number) =>
    Math.max(1, Math.min(99, 50 + ((v - mid) / halfSpan) * 15))

  const valuePct = toBarPct(value)
  const isOutOfRange = value < rangeMin || value > rangeMax

  return (
    <div className="relative mt-3 mb-1">
      {/* Triangle indicator */}
      <div
        className="absolute -top-0.5 -translate-x-1/2 w-0 h-0"
        style={{
          left: `${valuePct}%`,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `6px solid ${isOutOfRange ? '#f87171' : '#fff'}`,
        }}
      />
      {/* Bar */}
      <div className="relative h-2 rounded-full overflow-hidden mt-1.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
        {/* Danger low */}
        <div className="absolute h-full left-0" style={{ width: '20%', background: 'rgba(239,68,68,0.55)' }} />
        {/* Suboptimal low */}
        <div className="absolute h-full" style={{ left: '20%', width: '15%', background: 'rgba(245,158,11,0.45)' }} />
        {/* Optimal zone */}
        <div className="absolute h-full" style={{ left: '35%', width: '30%', background: 'rgba(16,185,129,0.60)' }} />
        {/* Suboptimal high */}
        <div className="absolute h-full" style={{ left: '65%', width: '15%', background: 'rgba(245,158,11,0.45)' }} />
        {/* Danger high */}
        <div className="absolute h-full" style={{ left: '80%', width: '20%', background: 'rgba(239,68,68,0.55)' }} />
        {/* Value line */}
        <div
          className={cn('absolute top-0 bottom-0 w-[2px]', isOutOfRange ? 'bg-red-400' : 'bg-white')}
          style={{ left: `${valuePct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Biomarker card ───────────────────────────────────────────────────────────

function BiomarkerCard({ marker }: { marker: Biomarker }) {
  const cfg = STATUS_CFG[marker.status] ?? STATUS_CFG.optimal
  const hasBar = marker.value_numeric !== null && marker.range_min !== null && marker.range_max !== null

  return (
    <div className={cn('border rounded-2xl px-4 py-3.5', cfg.cardClass)}>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">{marker.name}</p>
          {marker.panel && (
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">{marker.panel}</p>
          )}
        </div>
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 flex items-center gap-1', cfg.badgeClass)}>
          <span>{cfg.icon}</span>
          <span>{cfg.label}</span>
        </span>
      </div>

      <div className="flex items-baseline gap-1.5 mt-2">
        <span className="text-2xl font-bold text-foreground tabular-nums">{marker.value}</span>
        {marker.unit && <span className="text-sm text-muted-foreground">{marker.unit}</span>}
      </div>

      {hasBar && (
        <RangeBar
          value={marker.value_numeric!}
          rangeMin={marker.range_min!}
          rangeMax={marker.range_max!}
        />
      )}

      {!hasBar && marker.reference_range && (
        <p className="text-[11px] text-muted-foreground/50 mt-1.5">Ref: {marker.reference_range}</p>
      )}

      {marker.note && (
        <p className="text-xs text-muted-foreground mt-2 leading-snug">{marker.note}</p>
      )}
    </div>
  )
}

// ─── Biomarker group ──────────────────────────────────────────────────────────

function BiomarkerGroup({ status, markers }: { status: BiomarkerStatus; markers: Biomarker[] }) {
  const [collapsed, setCollapsed] = useState(status === 'optimal' && markers.length > 6)
  if (markers.length === 0) return null
  const cfg = STATUS_CFG[status]

  return (
    <div>
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between py-1 group"
      >
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', cfg.badgeClass)}>
            {cfg.icon} {cfg.groupLabel}
          </span>
          <span className="text-xs text-muted-foreground">{markers.length} biomarker{markers.length !== 1 ? 's' : ''}</span>
        </div>
        {collapsed
          ? <ChevronDown size={14} className="text-muted-foreground/40" />
          : <ChevronUp size={14} className="text-muted-foreground/40" />}
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
          {markers.map((m, i) => <BiomarkerCard key={i} marker={m} />)}
        </div>
      )}
    </div>
  )
}

// ─── Report card ──────────────────────────────────────────────────────────────

function ReportCard({ report, onDelete, onUpdate }: { report: Report; onDelete: (id: string) => void; onUpdate: (updated: Report) => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const [reanalysing, setReanalysing] = useState(false)
  const [reanalyseError, setReanalyseError] = useState<string | null>(null)

  const handleReanalyse = async () => {
    setReanalysing(true)
    setReanalyseError(null)
    try {
      const res = await fetch(`/api/lab/${report.id}`, { method: 'PATCH' })
      const data = await res.json()
      if (res.ok) {
        onUpdate(data)
        setCollapsed(false)
      } else {
        setReanalyseError(data.error ?? 'Re-analysis failed')
      }
    } catch {
      setReanalyseError('Re-analysis failed. Please try again.')
    } finally {
      setReanalysing(false)
    }
  }
  const sd = report.structured_data
  const overall = sd?.overall_status ? OVERALL_CFG[sd.overall_status] : null
  const allMarkers = sd ? getBiomarkers(sd) : []

  const byStatus = {
    out_of_range: allMarkers.filter(m => m.status === 'out_of_range'),
    sufficient:   allMarkers.filter(m => m.status === 'sufficient'),
    optimal:      allMarkers.filter(m => m.status === 'optimal'),
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="w-9 h-9 rounded-xl bg-[#c8a98a]/10 flex items-center justify-center shrink-0">
          <FlaskConical size={16} className="text-[#c8a98a]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{report.filename}</p>
            {overall && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full border', overall.badgeClass)}>
                {overall.label}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {report.report_date ? fmtDate(report.report_date) : fmtDate(report.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={handleReanalyse}
            disabled={reanalysing}
            title="Re-analyse with current schema"
            className="p-2 text-muted-foreground hover:text-[#c8a98a] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={reanalysing ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setCollapsed(c => !c)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          <button onClick={() => onDelete(report.id)} className="p-2 text-muted-foreground hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {reanalyseError && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border text-xs text-red-400">
          <AlertCircle size={13} className="shrink-0" />
          {reanalyseError}
        </div>
      )}

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          {sd ? (
            <>
              {/* Summary + stats row */}
              <div className={cn('px-3.5 py-3 rounded-xl border text-sm leading-relaxed', overall?.summaryClass ?? 'bg-muted/20 border-border text-foreground/80')}>
                {sd.summary}
              </div>

              {/* Counts row */}
              {allMarkers.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground font-medium">{allMarkers.length} biomarkers</span>
                  {byStatus.out_of_range.length > 0 && (
                    <span className="text-[11px] font-semibold text-red-400">
                      ! {byStatus.out_of_range.length} out of range
                    </span>
                  )}
                  {byStatus.sufficient.length > 0 && (
                    <span className="text-[11px] font-semibold text-amber-400">
                      ● {byStatus.sufficient.length} sufficient
                    </span>
                  )}
                  {byStatus.optimal.length > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-400">
                      ✓ {byStatus.optimal.length} optimal
                    </span>
                  )}
                </div>
              )}

              {/* Grouped biomarker cards */}
              {allMarkers.length > 0 ? (
                <div className="space-y-4">
                  <BiomarkerGroup status="out_of_range" markers={byStatus.out_of_range} />
                  <BiomarkerGroup status="sufficient"   markers={byStatus.sufficient} />
                  <BiomarkerGroup status="optimal"      markers={byStatus.optimal} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{sd.summary}</p>
              )}

              {/* Recommendations */}
              {sd.recommendations.length > 0 && (
                <div className="border-t border-border pt-4 space-y-1.5">
                  <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">Recommendations</p>
                  {sd.recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-2.5 text-sm text-foreground/80">
                      <span className="text-[#c8a98a] font-bold tabular-nums shrink-0">{i + 1}.</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Disclaimer */}
              {sd.disclaimer && (
                <p className="text-[11px] text-muted-foreground/35 italic border-t border-border pt-3">
                  {sd.disclaimer}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-foreground/70 leading-relaxed">{report.summary}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LabClient({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState<Report[]>(initialReports)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [reportDate, setReportDate] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    setUploadError(null)
    const fd = new FormData()
    fd.append('file', file)
    if (reportDate) fd.append('report_date', reportDate)
    try {
      const res = await fetch('/api/lab', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) { setUploadError(data.error ?? 'Upload failed'); return }
      setReports(prev => [data, ...prev])
      setReportDate('')
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [reportDate])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleUpload(f)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files[0]
    if (f) handleUpload(f)
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/lab/${id}`, { method: 'DELETE' })
    if (res.ok) setReports(prev => prev.filter(r => r.id !== id))
  }

  const handleUpdate = (updated: Report) => {
    setReports(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Lab Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload any test — AI analyses and groups every biomarker</p>
      </div>

      {/* Upload card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div
          onDragOver={e => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={cn(
            'flex items-center gap-4 px-4 py-4 cursor-pointer transition-all',
            dragActive ? 'bg-[#c8a98a]/8' : 'hover:bg-white/[0.02]',
            uploading && 'pointer-events-none',
          )}
        >
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', dragActive ? 'bg-[#c8a98a]/20' : 'bg-[#c8a98a]/10')}>
            {uploading
              ? <Loader2 size={18} className="text-[#c8a98a] animate-spin" />
              : <Upload size={18} className="text-[#c8a98a]" />}
          </div>
          <div className="flex-1 min-w-0">
            {uploading ? (
              <>
                <p className="text-sm font-semibold text-foreground">Analysing your report…</p>
                <p className="text-xs text-muted-foreground mt-0.5">This takes around 15–30 seconds</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">Upload a lab report</p>
                <p className="text-xs text-muted-foreground mt-0.5">PDF or image · max 20MB · blood, urine, hormones, vitamins…</p>
              </>
            )}
          </div>
          {!uploading && (
            <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
              <Calendar size={13} className="text-muted-foreground" />
              <input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                className="text-xs bg-transparent border border-border rounded-lg px-2 py-1.5 text-muted-foreground focus:outline-none focus:border-[#c8a98a]/40 w-32"
              />
            </div>
          )}
        </div>
        {uploadError && (
          <div className="border-t border-border flex items-center gap-2 px-4 py-2.5 text-xs text-red-400">
            <AlertCircle size={13} className="shrink-0" />
            {uploadError}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Reports list */}
      {reports.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest px-1">
            Reports ({reports.length})
          </p>
          {reports.map(r => (
            <ReportCard key={r.id} report={r} onDelete={handleDelete} onUpdate={handleUpdate} />
          ))}
        </div>
      )}

      {reports.length === 0 && !uploading && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <FlaskConical size={32} className="text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">No reports yet</p>
          <p className="text-xs text-muted-foreground/50">Upload a blood test, urine test, or any other lab result</p>
        </div>
      )}
    </div>
  )
}

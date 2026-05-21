'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { PlusCircle } from 'lucide-react'
import { PageInsightBanner } from '@/components/page-insight-banner'
import TemplatePicker from '@/components/training/TemplatePicker'
import ActiveSession from '@/components/training/ActiveSession'
import SessionHistory from '@/components/training/SessionHistory'
import ProgressDashboard from '@/components/training/ProgressDashboard'
import AIPexPanel from '@/components/training/AIPexPanel'
import QuickLogModal from '@/components/training/QuickLogModal'
import BaselineSetup from '@/components/training/BaselineSetup'

type SubTab = 'ai' | 'templates' | 'history' | 'progress'

interface ActiveSessionMeta {
  sessionId: string
  templateId: string
  templateName: string
  templateColor: string
}

export default function TrainingPage() {
  const [subTab, setSubTab] = useState<SubTab>('ai')
  const [active, setActive] = useState<ActiveSessionMeta | null>(null)
  const [gender, setGender] = useState<string>('male')
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [showBaselines, setShowBaselines] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { if (d.profile?.gender) setGender(d.profile.gender) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('sessionId')
    const templateId = params.get('templateId')
    const templateName = params.get('templateName')
    const color = params.get('color')
    if (sessionId && templateId && templateName && color) {
      setActive({ sessionId, templateId, templateName, templateColor: color })
      window.history.replaceState({}, '', '/training')
    }
  }, [])

  async function handleSelectTemplate(templateId: string, templateName: string, templateColor: string) {
    const res = await fetch('/api/training/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: new Date().toISOString().split('T')[0],
        session_type: templateName.toLowerCase().replace(/\s+/g, '_'),
        template_id: templateId,
        started_at: new Date().toISOString(),
      }),
    })
    const session = await res.json()
    setActive({ sessionId: session.id, templateId, templateName, templateColor })
  }

  function handleFinishSession() {
    setActive(null)
    setSubTab('templates')
  }

  if (active) {
    return (
      <ActiveSession
        sessionId={active.sessionId}
        templateId={active.templateId}
        templateName={active.templateName}
        templateColor={active.templateColor}
        gender={gender}
        onFinish={handleFinishSession}
      />
    )
  }

  const tabs: { key: SubTab; label: string }[] = [
    { key: 'ai', label: 'AI Plan' },
    { key: 'templates', label: 'Templates' },
    { key: 'history', label: 'History' },
    { key: 'progress', label: 'Stats' },
  ]

  return (
    <>
    {showQuickLog && (
      <QuickLogModal
        onClose={() => setShowQuickLog(false)}
        onLogged={() => setShowQuickLog(false)}
      />
    )}
    {showBaselines && (
      <BaselineSetup
        onClose={() => setShowBaselines(false)}
        onSaved={() => setShowBaselines(false)}
      />
    )}
    <div className="min-h-screen bg-background">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-foreground">Train</h1>
          <button
            onClick={() => setShowQuickLog(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#c8a97e] border border-[#2c2c2e] rounded-full px-3 py-1.5 hover:border-[#c8a97e] transition-colors"
          >
            <PlusCircle size={13} />
            Log Custom
          </button>
        </div>

        <div className="mb-4">
          <PageInsightBanner page="training" />
        </div>

        <div className="flex gap-1 bg-secondary/50 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className={cn(
                'flex-1 py-2 px-1 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap',
                subTab === tab.key
                  ? tab.key === 'ai'
                    ? 'bg-orange-500 text-white'
                    : 'bg-card text-foreground'
                  : 'text-zinc-500 hover:text-zinc-400'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6 pb-6">
        {subTab === 'ai' && <AIPexPanel onSelectTemplate={handleSelectTemplate} gender={gender} />}
        {subTab === 'templates' && <TemplatePicker onSelectTemplate={handleSelectTemplate} gender={gender} />}
        {subTab === 'history' && <SessionHistory />}
        {subTab === 'progress' && (
          <>
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setShowBaselines(true)}
                className="text-xs font-semibold text-[#c8a97e] border border-[#2c2c2e] rounded-full px-3 py-1.5 hover:border-[#c8a97e] transition-colors"
              >
                Set starting numbers
              </button>
            </div>
            <ProgressDashboard />
          </>
        )}
      </div>
    </div>
    </>
  )
}

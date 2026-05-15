'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import TemplatePicker from '@/components/training/TemplatePicker'
import ActiveSession from '@/components/training/ActiveSession'
import SessionHistory from '@/components/training/SessionHistory'
import ProgressDashboard from '@/components/training/ProgressDashboard'
import AIPexPanel from '@/components/training/AIPexPanel'

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
    { key: 'progress', label: 'Progress' },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 md:px-6 pt-4 md:pt-6 pb-5">
        <h1 className="text-3xl font-bold text-foreground mb-5">Train</h1>

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
        {subTab === 'progress' && <ProgressDashboard />}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import TemplatePicker from '@/components/training/TemplatePicker'
import ActiveSession from '@/components/training/ActiveSession'
import SessionHistory from '@/components/training/SessionHistory'
import ProgressDashboard from '@/components/training/ProgressDashboard'

type SubTab = 'templates' | 'history' | 'progress'

interface ActiveSessionMeta {
  sessionId: string
  templateId: string
  templateName: string
  templateColor: string
}

export default function TrainingPage() {
  const [subTab, setSubTab] = useState<SubTab>('templates')
  const [active, setActive] = useState<ActiveSessionMeta | null>(null)
  const [gender, setGender] = useState<string>('male')

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => { if (d.profile?.gender) setGender(d.profile.gender) })
      .catch(() => {})
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
    { key: 'templates', label: 'Templates' },
    { key: 'history', label: 'History' },
    { key: 'progress', label: 'Progress' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000' }}>
      <div style={{ padding: '48px 20px 0' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>Train</h1>

        <div style={{
          display: 'flex', gap: '4px',
          backgroundColor: '#111', borderRadius: '12px', padding: '4px',
          marginBottom: '20px',
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              style={{
                flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
                backgroundColor: subTab === tab.key ? '#fff' : 'transparent',
                color: subTab === tab.key ? '#000' : '#71717a',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 20px 24px' }}>
        {subTab === 'templates' && <TemplatePicker onSelectTemplate={handleSelectTemplate} gender={gender} />}
        {subTab === 'history' && <SessionHistory />}
        {subTab === 'progress' && <ProgressDashboard />}
      </div>
    </div>
  )
}

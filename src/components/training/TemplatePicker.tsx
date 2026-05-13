'use client'

import { useEffect, useState } from 'react'
import { Dumbbell, Clock, Play } from 'lucide-react'
import TemplateDetail from './TemplateDetail'

interface Template {
  id: string
  name: string
  description: string
  color: string
  sort_order: number
  last_used: string | null
}

interface Props {
  onSelectTemplate: (templateId: string, templateName: string, templateColor: string) => void
  gender?: string
}

function formatLastUsed(dateStr: string | null): string {
  if (!dateStr) return 'Never done'
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 14) return '1 week ago'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return `${Math.floor(diffDays / 30)}mo ago`
}

export default function TemplatePicker({ onSelectTemplate, gender = 'male' }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState<Template | null>(null)

  useEffect(() => {
    fetch('/api/training/templates')
      .then(r => r.json())
      .then(data => { setTemplates(data); setLoading(false) })
  }, [])

  if (viewing) {
    return (
      <TemplateDetail
        templateId={viewing.id}
        templateName={viewing.name}
        templateColor={viewing.color}
        gender={gender}
        onStart={() => onSelectTemplate(viewing.id, viewing.name, viewing.color)}
        onBack={() => setViewing(null)}
      />
    )
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            height: '76px', backgroundColor: '#111',
            borderRadius: '18px', border: '1px solid #1c1c1c',
          }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ fontSize: '13px', color: '#52525b', marginBottom: '4px', fontWeight: 500 }}>
        PICK A TEMPLATE
      </div>

      {templates.map(t => (
        <div
          key={t.id}
          style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            width: '100%', backgroundColor: '#111',
            border: '1px solid #1c1c1c', borderRadius: '18px',
            padding: '14px 14px 14px 16px',
          }}
        >
          {/* Color dot */}
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            backgroundColor: t.color, flexShrink: 0,
          }} />

          {/* Name + description — tappable to view instructions */}
          <button
            onClick={() => setViewing(t)}
            style={{
              flex: 1, minWidth: 0, background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left', padding: 0,
            }}
          >
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#fff' }}>{t.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
              <span style={{ fontSize: '12px', color: '#52525b' }}>{t.description}</span>
              {t.description && <span style={{ fontSize: '12px', color: '#3f3f46' }}>·</span>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Clock size={10} color="#3f3f46" />
                <span style={{ fontSize: '11px', color: '#3f3f46' }}>{formatLastUsed(t.last_used)}</span>
              </div>
            </div>
          </button>

          {/* Start button */}
          <button
            onClick={() => onSelectTemplate(t.id, t.name, t.color)}
            title="Start workout"
            style={{
              width: '38px', height: '38px', borderRadius: '12px',
              backgroundColor: t.color + '22', border: `1px solid ${t.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0, transition: 'background-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = t.color + '44')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = t.color + '22')}
          >
            <Play size={15} color={t.color} fill={t.color} />
          </button>
        </div>
      ))}

      {templates.length === 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: '12px', padding: '48px 20px', color: '#52525b',
        }}>
          <Dumbbell size={32} color="#27272a" />
          <span style={{ fontSize: '14px' }}>No templates yet</span>
        </div>
      )}
    </div>
  )
}

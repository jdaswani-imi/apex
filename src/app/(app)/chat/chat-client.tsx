'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Zap, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  "What should I eat to hit protein today?",
  "Give me today's workout",
  "How's my progress to Tomorrowland?",
  "What time should I sleep tonight?",
]

export function ChatClient({ onboardingCompleted }: { onboardingCompleted: boolean }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  // Accumulator ref for streaming — avoids React immutability lint violation
  const accumulatorRef = useRef('')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    const userMsg: Message = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setStreaming(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages([...next, assistantMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok || !res.body) throw new Error('Failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      accumulatorRef.current = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // Write to ref to accumulate — avoids React immutability lint violation
        accumulatorRef.current += decoder.decode(value, { stream: true })
        const snapshot = accumulatorRef.current
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: snapshot }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Try again.' }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const empty = messages.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', backgroundColor: '#000' }}>

      {/* Header */}
      <div style={{
        padding: '56px 20px 12px',
        borderBottom: '1px solid #111',
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
      }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '10px',
          backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Zap size={16} color="#f97316" fill="#f97316" />
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Apex</div>
          <div style={{ fontSize: '11px', color: '#52525b' }}>Personal optimisation coach</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
        {empty && (
          <div style={{ paddingTop: '32px' }}>
            {!onboardingCompleted && (
              <Link
                href="/onboarding"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: 'rgba(249,115,22,0.08)',
                  border: '1px solid rgba(249,115,22,0.25)',
                  borderRadius: '14px', padding: '14px 16px',
                  marginBottom: '16px', textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#f97316', marginBottom: '2px' }}>
                    Complete your profile
                  </div>
                  <div style={{ fontSize: '12px', color: '#71717a' }}>
                    Personalise Apex so I can give you tailored advice
                  </div>
                </div>
                <ChevronRight size={16} color="#f97316" style={{ flexShrink: 0, marginLeft: '8px' }} />
              </Link>
            )}
            <p style={{ fontSize: '13px', color: '#3f3f46', textAlign: 'center', marginBottom: '16px' }}>
              {onboardingCompleted ? 'Ask me anything about today' : 'Or ask me anything to get started'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    backgroundColor: '#111', border: '1px solid #1c1c1c',
                    borderRadius: '12px', padding: '12px 14px',
                    fontSize: '13px', color: '#a1a1aa',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: m.role === 'user' ? '#f97316' : '#111',
                border: m.role === 'assistant' ? '1px solid #1c1c1c' : 'none',
                fontSize: '14px',
                lineHeight: '1.5',
                color: m.role === 'user' ? '#000' : '#e4e4e7',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {m.content}
              {m.role === 'assistant' && streaming && i === messages.length - 1 && m.content === '' && (
                <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center', height: '14px' }}>
                  {[0, 1, 2].map(j => (
                    <span
                      key={j}
                      style={{
                        width: '4px', height: '4px', borderRadius: '50%',
                        backgroundColor: '#52525b',
                        animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '8px 12px 32px',
        borderTop: '1px solid #111',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: '8px',
          backgroundColor: '#111', border: '1px solid #27272a',
          borderRadius: '16px', padding: '8px 8px 8px 14px',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message Apex..."
            rows={1}
            disabled={streaming}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: '14px', color: '#e4e4e7', resize: 'none',
              fontFamily: 'inherit', lineHeight: '1.5',
              maxHeight: '120px', overflowY: 'auto',
              paddingTop: '2px',
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || streaming}
            style={{
              width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
              backgroundColor: input.trim() && !streaming ? '#f97316' : '#1c1c1c',
              border: 'none', cursor: input.trim() && !streaming ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background-color 0.15s',
            }}
          >
            <Send size={14} color={input.trim() && !streaming ? '#000' : '#3f3f46'} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

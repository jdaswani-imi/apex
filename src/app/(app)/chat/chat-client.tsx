'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Zap, ChevronRight, CheckCircle, Database, Pencil } from 'lucide-react'
import Link from 'next/link'

interface ToolCall {
  tool: string
  label: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  typing?: boolean
}

const SUGGESTIONS = [
  "What should I eat to hit protein today?",
  "Give me today's workout",
  "How's my progress to Tomorrowland?",
  "What time should I sleep tonight?",
  "Log 150g chicken breast for lunch",
  "How's my recovery trend this week?",
]

// Simple markdown → JSX renderer
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let listItems: string[] = []
  let keyCounter = 0
  let inCodeBlock = false
  let codeLines: string[] = []
  let tableRows: string[][] = []
  let inTable = false

  function flushList() {
    if (listItems.length === 0) return
    result.push(
      <ul key={`ul-${keyCounter++}`} style={{ margin: '6px 0', paddingLeft: '16px' }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ color: '#d4d4d8', fontSize: '14px', lineHeight: '1.6', marginBottom: '2px' }}>
            {renderInline(item)}
          </li>
        ))}
      </ul>
    )
    listItems = []
  }

  function flushTable() {
    if (tableRows.length === 0) return
    const [header, , ...body] = tableRows
    result.push(
      <div key={`tbl-${keyCounter++}`} style={{ overflowX: 'auto', margin: '8px 0' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
          <thead>
            <tr>
              {(header ?? []).map((cell, i) => (
                <th key={i} style={{ padding: '6px 10px', borderBottom: '1px solid #2a2a2a', color: '#a1a1aa', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>
                  {cell.trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '5px 10px', borderBottom: '1px solid #1a1a1a', color: '#d4d4d8' }}>
                    {renderInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    tableRows = []
    inTable = false
  }

  function flushCode() {
    if (codeLines.length === 0) return
    result.push(
      <pre key={`code-${keyCounter++}`} style={{
        backgroundColor: '#0f0f0f', border: '1px solid #1c1c1c',
        borderRadius: '8px', padding: '10px 12px', margin: '6px 0',
        fontSize: '12px', color: '#a1a1aa', overflowX: 'auto',
        fontFamily: 'monospace', lineHeight: '1.7', whiteSpace: 'pre',
      }}>
        {codeLines.join('\n')}
      </pre>
    )
    codeLines = []
    inCodeBlock = false
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Code fences
    if (trimmed.startsWith('```')) {
      if (!inCodeBlock) {
        flushList()
        flushTable()
        inCodeBlock = true
        codeLines = []
      } else {
        flushCode()
      }
      continue
    }
    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // Tables (pipe-delimited rows)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList()
      const cells = trimmed.slice(1, -1).split('|')
      tableRows.push(cells)
      inTable = true
      continue
    }
    if (inTable && !trimmed.startsWith('|')) {
      flushTable()
    }

    if (trimmed.startsWith('### ')) {
      flushList()
      result.push(<p key={keyCounter++} style={{ fontSize: '13px', fontWeight: 700, color: '#f97316', marginBottom: '4px', marginTop: '8px' }}>{trimmed.slice(4)}</p>)
    } else if (trimmed.startsWith('## ')) {
      flushList()
      result.push(<p key={keyCounter++} style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '4px', marginTop: '10px' }}>{trimmed.slice(3)}</p>)
    } else if (trimmed.startsWith('# ')) {
      flushList()
      result.push(<p key={keyCounter++} style={{ fontSize: '15px', fontWeight: 700, color: '#fff', marginBottom: '6px', marginTop: '10px' }}>{trimmed.slice(2)}</p>)
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      listItems.push(trimmed.slice(2))
    } else if (/^\d+\.\s/.test(trimmed)) {
      listItems.push(trimmed.replace(/^\d+\.\s/, ''))
    } else if (trimmed === '') {
      flushList()
      result.push(<div key={keyCounter++} style={{ height: '6px' }} />)
    } else {
      flushList()
      result.push(<p key={keyCounter++} style={{ margin: '0 0 4px', color: '#e4e4e7', fontSize: '14px', lineHeight: '1.6' }}>{renderInline(trimmed)}</p>)
    }
  }
  flushList()
  flushTable()
  flushCode()
  return result
}

function renderInline(text: string): React.ReactNode {
  // Handle **bold**, *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: '#fff', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: '#a1a1aa' }}>{part.slice(1, -1)}</em>
    }
    return part
  })
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  log_food: <CheckCircle size={10} color="#4ade80" />,
  update: <Pencil size={10} color="#60a5fa" />,
  read: <Database size={10} color="#a78bfa" />,
}

export function ChatClient({ onboardingCompleted }: { onboardingCompleted: boolean }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function typewriterEffect(fullText: string, messageIndex: number) {
    let i = 0
    const speed = Math.max(4, Math.min(12, Math.round(fullText.length / 120)))

    function tick() {
      i = Math.min(i + speed, fullText.length)
      setMessages(prev => {
        const updated = [...prev]
        updated[messageIndex] = { ...updated[messageIndex], content: fullText.slice(0, i), typing: i < fullText.length }
        return updated
      })
      if (i < fullText.length) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = { role: 'user', content }
    const next = [...messages, userMsg]
    setMessages([...next, { role: 'assistant', content: '', typing: true }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) throw new Error('Failed')

      const data = await res.json() as { text: string; toolCalls: ToolCall[] }
      const assistantIndex = next.length

      setMessages(prev => {
        const updated = [...prev]
        updated[assistantIndex] = {
          role: 'assistant',
          content: '',
          toolCalls: data.toolCalls,
          typing: true,
        }
        return updated
      })

      // Start typewriter animation
      typewriterEffect(data.text, assistantIndex)
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: 'Something went wrong. Try again.',
        }
        return updated
      })
    } finally {
      setLoading(false)
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
    <div className="flex flex-col h-dvh bg-background">

      {/* Header */}
      <div className="flex items-center gap-2.5 shrink-0 px-5 pt-4 pb-3 border-b border-border">
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
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
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
              {onboardingCompleted ? 'Ask me anything — I know your data' : 'Or ask me anything to get started'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-zinc-400 text-left hover:border-white/15 hover:text-zinc-300 transition-colors cursor-pointer"
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
              flexDirection: 'column',
              alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '12px',
            }}
          >
            {/* Tool call badges — show above assistant message */}
            {m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px', maxWidth: '85%' }}>
                {m.toolCalls.map((tc, j) => (
                  <div
                    key={j}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                      borderRadius: '8px', padding: '3px 8px',
                      fontSize: '11px', color: '#71717a',
                    }}
                  >
                    {TOOL_ICONS[tc.tool] ?? <Database size={10} color="#71717a" />}
                    {tc.label}
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                maxWidth: '85%',
                padding: m.role === 'user' ? '10px 14px' : '12px 14px',
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: m.role === 'user' ? '#f97316' : 'var(--card)',
                border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                color: m.role === 'user' ? '#000' : '#e4e4e7',
                wordBreak: 'break-word',
              }}
            >
              {m.role === 'user' ? (
                <span style={{ fontSize: '14px', lineHeight: '1.5' }}>{m.content}</span>
              ) : m.content === '' && m.typing ? (
                /* Thinking dots */
                <span style={{ display: 'inline-flex', gap: '3px', alignItems: 'center', height: '14px', padding: '2px 0' }}>
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
              ) : (
                /* Markdown-rendered assistant response */
                <div>
                  {renderMarkdown(m.content)}
                  {m.typing && (
                    <span style={{
                      display: 'inline-block', width: '2px', height: '14px',
                      backgroundColor: '#f97316', marginLeft: '1px',
                      animation: 'cursor-blink 0.8s ease-in-out infinite',
                      verticalAlign: 'text-bottom',
                    }} />
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pt-2 pb-8 border-t border-border shrink-0">
        <div className="flex items-end gap-2 bg-card border border-border rounded-2xl px-4 py-2">
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
            disabled={loading}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: '14px', color: '#e4e4e7', resize: 'none',
              fontFamily: 'inherit', lineHeight: '1.5',
              maxHeight: '120px', overflowY: 'auto', paddingTop: '2px',
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center transition-colors duration-150 disabled:cursor-default"
            style={{ backgroundColor: input.trim() && !loading ? '#f97316' : 'var(--secondary)' }}
          >
            <Send size={14} color={input.trim() && !loading ? '#000' : '#52525b'} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

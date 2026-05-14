'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Pill, Moon, TrendingUp, Sparkles, Wind,
  Settings, ChevronRight, UserCircle, LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const sections = [
  {
    title: 'Track',
    items: [
      { href: '/supplements', icon: Pill, label: 'Supplements', desc: 'Daily stack adherence', color: '#f59e0b' },
      { href: '/sleep', icon: Moon, label: 'Sleep', desc: 'WHOOP sleep data & recovery', color: '#6366f1' },
      { href: '/progress', icon: TrendingUp, label: 'Progress', desc: 'Body metrics & trends', color: '#10b981' },
    ],
  },
  {
    title: 'Grooming',
    items: [
      { href: '/skincare', icon: Sparkles, label: 'Skincare', desc: 'Morning & evening routine', color: '#ec4899' },
      { href: '/hair', icon: Wind, label: 'Hair', desc: 'Hair care routine', color: '#14b8a6' },
    ],
  },
  {
    title: 'Account',
    items: [
      { href: '/onboarding', icon: UserCircle, label: 'Complete Profile', desc: 'Full preferences questionnaire', color: '#f97316' },
      { href: '/settings', icon: Settings, label: 'Settings', desc: 'Profile, goals, training, WHOOP', color: '#71717a' },
    ],
  },
]

export default function MorePage() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ padding: '48px 20px 24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>More</h1>
      <p style={{ fontSize: '14px', color: '#52525b', marginBottom: '32px' }}>Tracking, grooming & account</p>

      {sections.map(section => (
        <div key={section.title} style={{ marginBottom: '28px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, color: '#3f3f46',
            textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: '10px',
          }}>
            {section.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {section.items.map(item => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    backgroundColor: '#0f0f0f', border: '1px solid #1c1c1c',
                    borderRadius: '16px', padding: '14px 16px',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                    backgroundColor: `${item.color}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Icon size={18} color={item.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: '#f4f4f5', marginBottom: '2px' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '12px', color: '#52525b' }}>{item.desc}</div>
                  </div>
                  <ChevronRight size={16} color="#3f3f46" />
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      <button
        onClick={handleSignOut}
        style={{
          display: 'flex', alignItems: 'center', gap: '14px',
          backgroundColor: '#0f0f0f', border: '1px solid #1c1c1c',
          borderRadius: '16px', padding: '14px 16px',
          width: '100%', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
          backgroundColor: '#ef444418',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LogOut size={18} color="#ef4444" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#ef4444' }}>Sign out</div>
          <div style={{ fontSize: '12px', color: '#52525b' }}>Sign out of your account</div>
        </div>
      </button>
    </div>
  )
}

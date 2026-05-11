'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Zap } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error } = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-orange-500/8 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-64 h-64 bg-orange-600/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 mb-4">
            <Zap size={24} className="text-orange-400" fill="currentColor" />
          </div>
          <h1 className="font-condensed text-6xl font-bold text-white tracking-tight uppercase text-glow-orange">
            APEX
          </h1>
          <p className="text-zinc-600 mt-1.5 text-sm tracking-widest uppercase">
            Personal Optimisation
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex bg-zinc-900/80 border border-white/[0.06] rounded-2xl p-1 mb-5">
          {(['login', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              aria-label={m === 'login' ? 'Sign in' : 'Sign up'}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer ${
                mode === m
                  ? 'bg-orange-500 text-black shadow-lg'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <input
              id="email"
              type="email"
              inputMode="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoComplete="email"
              className="w-full bg-zinc-900/80 border border-white/[0.08] rounded-2xl px-4 py-4 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full bg-zinc-900/80 border border-white/[0.08] rounded-2xl px-4 py-4 text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all text-sm"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            aria-label={mode === 'login' ? 'Sign in' : 'Create account'}
            className="w-full bg-orange-500 text-black font-bold py-4 rounded-2xl hover:bg-orange-400 active:scale-[0.98] transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 glow-orange cursor-pointer mt-1"
          >
            {loading
              ? <Loader2 size={16} className="animate-spin" />
              : mode === 'login' ? 'Sign in' : 'Create account'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

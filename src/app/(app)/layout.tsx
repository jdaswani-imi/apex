'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, Dumbbell, UtensilsCrossed, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', icon: Home, label: 'Today' },
  { href: '/chat', icon: MessageCircle, label: 'Coach' },
  { href: '/training', icon: Dumbbell, label: 'Train' },
  { href: '/food', icon: UtensilsCrossed, label: 'Food' },
  { href: '/more', icon: LayoutGrid, label: 'More' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col min-h-screen bg-black max-w-lg mx-auto">
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      <nav
        aria-label="Main navigation"
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-black/85 backdrop-blur-2xl border-t border-white/[0.06] safe-bottom z-50"
      >
        <div className="flex items-center justify-around px-2 py-2">
          {nav.map(({ href, icon: Icon, label }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200 cursor-pointer min-w-[44px] min-h-[44px] justify-center',
                  active ? 'text-orange-400' : 'text-zinc-600 hover:text-zinc-400'
                )}
              >
                {active && (
                  <span className="absolute inset-0 bg-orange-500/10 rounded-2xl" />
                )}
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 1.5}
                  className="relative"
                />
                <span className={cn(
                  'text-[10px] font-semibold relative tracking-wide',
                  active ? 'text-orange-400' : 'text-zinc-600'
                )}>
                  {label}
                </span>
                {active && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-400" />
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

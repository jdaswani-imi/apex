'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Brain, Dumbbell, Utensils, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/', icon: Home, label: 'Today' },
  { href: '/chat', icon: Brain, label: 'Coach' },
  { href: '/training', icon: Dumbbell, label: 'Train' },
  { href: '/food', icon: Utensils, label: 'Food' },
  { href: '/more', icon: LayoutGrid, label: 'More' },
]

function DesktopSidebar() {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex flex-col w-44 shrink-0 border-r border-white/[0.07] h-screen sticky top-0">
      <div className="px-4 py-4 border-b border-white/[0.07]">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
            <span className="font-bold text-xs">A</span>
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground">Apex</span>
        </Link>
      </div>

      <nav className="flex flex-col gap-0.5 px-2 py-3">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                active
                  ? 'bg-primary/15 text-primary'
                  : 'text-foreground/40 hover:text-foreground/80 hover:bg-white/[0.05]'
              )}
            >
              <Icon size={16} strokeWidth={active ? 2.5 : 1.75} className="shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function MobileBottomNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-2xl border-t border-white/[0.07] z-50"
    >
      <div className="flex items-center justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-150 min-w-[52px] min-h-[48px] justify-center',
                active ? 'text-primary' : 'text-foreground/30 hover:text-foreground/60'
              )}
            >
              {active && (
                <span className="absolute inset-0 bg-primary/10 rounded-xl" />
              )}
              <Icon size={22} strokeWidth={active ? 2.5 : 1.5} className="relative" />
              <span className={cn(
                'text-[10px] font-semibold relative tracking-wide',
                active ? 'text-primary' : 'text-foreground/30'
              )}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <DesktopSidebar />
      <main className="flex-1 pb-20 md:pb-0 min-w-0">
        <div className="w-full max-w-5xl mx-auto">
          {children}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  )
}

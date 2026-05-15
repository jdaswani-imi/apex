'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, MessageCircle, Dumbbell, UtensilsCrossed, LayoutGrid } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'

const nav = [
  { href: '/', icon: Home, label: 'Today' },
  { href: '/chat', icon: MessageCircle, label: 'Coach' },
  { href: '/training', icon: Dumbbell, label: 'Train' },
  { href: '/food', icon: UtensilsCrossed, label: 'Food' },
  { href: '/more', icon: LayoutGrid, label: 'More' },
]

function MobileBottomNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-sidebar/95 backdrop-blur-2xl border-t border-sidebar-border safe-bottom z-50"
    >
      <div className="flex items-center justify-around px-2 py-2">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-150 min-w-[52px] min-h-[48px] justify-center',
                active ? 'text-primary' : 'text-sidebar-foreground/40 hover:text-sidebar-foreground/70'
              )}
            >
              {active && (
                <span className="absolute inset-0 bg-primary/10 rounded-xl" />
              )}
              <Icon size={22} strokeWidth={active ? 2.5 : 1.5} className="relative" />
              <span className={cn(
                'text-[10px] font-semibold relative tracking-wide',
                active ? 'text-primary' : 'text-sidebar-foreground/40'
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
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col bg-background">
        {/* Desktop header bar with sidebar trigger */}
        <header className="hidden md:flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="h-4" />
        </header>

        {/* Main content */}
        <main className="flex-1 pb-20 md:pb-0">
          <div className="w-full max-w-5xl mx-auto">
            {children}
          </div>
        </main>
      </SidebarInset>

      {/* Mobile bottom navigation */}
      <MobileBottomNav />
    </SidebarProvider>
  )
}

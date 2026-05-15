'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  MessageCircle,
  Dumbbell,
  UtensilsCrossed,
  LayoutGrid,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'

const nav = [
  { href: '/', icon: Home, label: 'Today' },
  { href: '/chat', icon: MessageCircle, label: 'Coach' },
  { href: '/training', icon: Dumbbell, label: 'Train' },
  { href: '/food', icon: UtensilsCrossed, label: 'Food' },
  { href: '/more', icon: LayoutGrid, label: 'More' },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" />}
              className="data-[active=true]:bg-sidebar-accent"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                <span className="font-bold text-sm">A</span>
              </div>
              <div className="flex flex-col gap-0.5 leading-none">
                <span className="font-bold text-base tracking-tight">Apex</span>
                <span className="text-xs text-sidebar-foreground/50">Personal Coach</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map(({ href, icon: Icon, label }) => {
                const active = pathname === href
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={href} />}
                      isActive={active}
                      tooltip={label}
                      className={
                        active
                          ? 'bg-sidebar-accent text-primary font-semibold'
                          : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                      }
                    >
                      <Icon size={18} strokeWidth={active ? 2.5 : 1.75} />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter />
      <SidebarRail />
    </Sidebar>
  )
}

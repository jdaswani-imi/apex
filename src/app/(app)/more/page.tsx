import Link from 'next/link'
import {
  Pill, Moon, TrendingUp, Sparkles, Wind, ChevronRight,
} from 'lucide-react'

const sections = [
  {
    title: 'Track',
    items: [
      { href: '/supplements', icon: Pill, label: 'Supplements', desc: 'Daily stack adherence', color: 'text-amber-400', bg: 'bg-amber-500/10' },
      { href: '/sleep', icon: Moon, label: 'Sleep', desc: 'WHOOP sleep data & recovery', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
      { href: '/progress', icon: TrendingUp, label: 'Progress', desc: 'Body metrics & trends', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ],
  },
  {
    title: 'Grooming',
    items: [
      { href: '/skincare', icon: Sparkles, label: 'Skincare', desc: 'Morning & evening routine', color: 'text-pink-400', bg: 'bg-pink-500/10' },
      { href: '/hair', icon: Wind, label: 'Hair', desc: 'Hair care routine', color: 'text-teal-400', bg: 'bg-teal-500/10' },
    ],
  },
]

export default function MorePage() {
  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">More</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Tracking & grooming</p>
      </div>

      {sections.map(section => (
        <div key={section.title}>
          <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2 px-1">
            {section.title}
          </p>
          <div className="bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border">
            {section.items.map(({ href, icon: Icon, label, desc, color, bg }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
              >
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={17} className={color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{desc}</p>
                </div>
                <ChevronRight size={15} className="text-muted-foreground/40 shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

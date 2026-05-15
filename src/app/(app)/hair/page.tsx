'use client'

import { Wind } from 'lucide-react'

export default function HairPage() {
  return (
    <div className="min-h-screen bg-background px-4 md:px-6 pt-4 md:pt-6 pb-8">
      <h1 className="text-3xl font-bold text-foreground leading-tight mb-1">Hair</h1>
      <p className="text-sm text-zinc-600 mb-12">Hair care routine</p>

      <div className="flex flex-col items-center justify-center text-center py-20 gap-5">
        <div className="bg-teal-500/10 border border-teal-500/15 flex items-center justify-center rounded-[22px]"
          style={{ width: '72px', height: '72px' }}>
          <Wind size={30} className="text-teal-400" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground mb-2">Coming soon</p>
          <p className="text-sm text-zinc-600 max-w-[260px] leading-relaxed">
            Track your hair care routine and product schedules here.
          </p>
        </div>
      </div>
    </div>
  )
}

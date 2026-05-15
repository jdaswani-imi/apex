'use client'

import { Sparkles } from 'lucide-react'

export default function SkincarePage() {
  return (
    <div className="min-h-screen bg-background px-4 md:px-6 pt-4 md:pt-6 pb-8">
      <h1 className="text-3xl font-bold text-foreground leading-tight mb-1">Skincare</h1>
      <p className="text-sm text-zinc-600 mb-12">Morning &amp; evening routine</p>

      <div className="flex flex-col items-center justify-center text-center py-20 gap-5">
        <div className="w-18 h-18 rounded-[22px] bg-pink-500/10 border border-pink-500/15 flex items-center justify-center"
          style={{ width: '72px', height: '72px' }}>
          <Sparkles size={30} className="text-pink-400" />
        </div>
        <div>
          <p className="text-lg font-bold text-foreground mb-2">Coming soon</p>
          <p className="text-sm text-zinc-600 max-w-[260px] leading-relaxed">
            Track your skincare routine and log morning &amp; evening products here.
          </p>
        </div>
      </div>
    </div>
  )
}

import { TrendingUp } from 'lucide-react'

export default function ProgressPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
        <TrendingUp size={32} className="text-green-400" />
      </div>
      <h2 className="font-condensed text-2xl font-bold text-white uppercase tracking-wide mb-2">Progress</h2>
      <p className="text-zinc-600 text-sm max-w-[200px] leading-relaxed">
        Charts, trends, and body composition tracking coming soon
      </p>
    </div>
  )
}

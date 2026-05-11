import { Dumbbell } from 'lucide-react'

export default function TrainingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mb-6">
        <Dumbbell size={32} className="text-orange-400" />
      </div>
      <h2 className="font-condensed text-2xl font-bold text-white uppercase tracking-wide mb-2">Training</h2>
      <p className="text-zinc-600 text-sm max-w-[200px] leading-relaxed">
        Full workout plans and session tracking coming soon
      </p>
    </div>
  )
}

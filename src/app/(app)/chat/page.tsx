import { MessageCircle, Zap } from 'lucide-react'

export default function ChatPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
          <MessageCircle size={32} className="text-orange-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
          <Zap size={12} className="text-black" fill="currentColor" />
        </div>
      </div>
      <h2 className="font-condensed text-2xl font-bold text-white uppercase tracking-wide mb-2">AI Coach</h2>
      <p className="text-zinc-600 text-sm max-w-[200px] leading-relaxed">
        Your personal optimisation coach is coming soon
      </p>
    </div>
  )
}

export default function DashboardLoading() {
  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-3 w-24 bg-white/5 rounded animate-pulse" />
          <div className="h-7 w-36 bg-white/5 rounded-xl animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
          <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* Week strip */}
      <div className="flex items-center justify-between gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 py-2">
            <div className="h-3 w-4 bg-white/5 rounded animate-pulse" />
            <div className="h-4 w-5 bg-white/5 rounded animate-pulse" />
            <div className="w-1.5 h-1.5 rounded-full bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Workout card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex-shrink-0 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-2 bg-white/5 rounded w-16 animate-pulse" />
          <div className="h-4 bg-white/5 rounded w-28 animate-pulse" />
          <div className="h-2 bg-white/5 rounded w-20 animate-pulse" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="md:grid md:grid-cols-2 md:gap-3 space-y-3 md:space-y-0">
        <div className="space-y-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 h-36 animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 h-28 animate-pulse" />
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 h-28 animate-pulse" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 h-36 animate-pulse" />
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 h-28 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

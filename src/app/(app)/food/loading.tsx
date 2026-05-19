export default function FoodLoading() {
  return (
    <div className="px-4 md:px-6 pt-4 md:pt-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
          <div className="h-7 w-32 bg-white/5 rounded-xl animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="w-10 h-10 rounded-2xl bg-white/5 animate-pulse" />
          <div className="w-10 h-10 rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* Totals card */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 mb-4 space-y-4">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-white/5 rounded animate-pulse" />
          <div className="h-2 w-full bg-white/5 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white/[0.03] rounded-xl p-3 h-16 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Meal groups */}
      <div className="space-y-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
            <div className="h-14 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}

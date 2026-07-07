export default function ChatsLoading() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Conversation list skeleton */}
      <div className="flex w-full flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 md:w-[320px] md:min-w-[320px]">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="skeleton h-5 w-12 rounded" />
        </div>
        <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="skeleton h-8 w-full rounded-md" />
        </div>
        <div className="flex gap-1 px-3 py-2 border-b border-zinc-100 dark:border-zinc-800/60">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-6 w-14 rounded-full" />
          ))}
        </div>
        <div className="flex-1 divide-y divide-zinc-50">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="skeleton size-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-28 rounded" />
                <div className="skeleton h-3 w-40 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Chat window skeleton — hidden on mobile */}
      <div className="hidden flex-1 flex-col bg-white md:flex">
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="skeleton size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-4 w-32 rounded" />
            <div className="skeleton h-3 w-24 rounded" />
          </div>
        </div>
        <div className="flex-1 space-y-4 px-4 py-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <div className={`skeleton h-12 rounded-lg ${i % 2 === 0 ? 'w-48' : 'w-56'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

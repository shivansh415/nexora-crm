export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl p-5 sm:p-6 lg:p-8">
      <div className="mb-7">
        <div className="skeleton h-6 w-40 rounded-full" />
        <div className="skeleton mt-3 h-8 w-56 rounded-lg" />
        <div className="skeleton mt-2 h-4 w-40 rounded" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between">
              <div className="skeleton size-11 rounded-xl" />
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
            <div className="skeleton mt-4 h-9 w-20 rounded-lg" />
            <div className="skeleton mt-2 h-3 w-28 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-32 rounded" />
                <div className="skeleton h-3 w-48 rounded" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-5">
          <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton h-4 w-full rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { AlertTriangle, RotateCw, LayoutDashboard } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 text-center" style={{ backgroundColor: 'var(--wa-bg)' }}>
      <div className="relative flex size-20 items-center justify-center rounded-3xl bg-red-50 dark:bg-red-500/10">
        <span className="pointer-events-none absolute inset-0 rounded-3xl bg-red-500/10 blur-xl" />
        <AlertTriangle className="relative size-9 text-red-500" strokeWidth={2} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Something went wrong</h1>
        <p className="mx-auto max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2.5">
        <button
          onClick={reset}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
          style={{ backgroundImage: 'var(--brand-gradient)', boxShadow: 'var(--brand-glow)' }}
        >
          <RotateCw className="size-4" /> Try again
        </button>
        <button
          onClick={() => { window.location.href = '/workspace/ws-001/dashboard' }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <LayoutDashboard className="size-4" /> Go to Dashboard
        </button>
      </div>
    </div>
  )
}

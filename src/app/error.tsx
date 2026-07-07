'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <div className="text-5xl">⚠️</div>
      <h1 className="text-xl font-semibold text-zinc-900">Something went wrong</h1>
      <p className="text-zinc-500 max-w-md text-sm">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
        >
          Try again
        </button>
        <button
          onClick={() => { window.location.href = '/workspace/ws-001/dashboard' }}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  )
}


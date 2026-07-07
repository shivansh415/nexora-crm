import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <div className="text-6xl font-bold text-zinc-200">404</div>
      <h1 className="text-2xl font-semibold text-zinc-900">Page not found</h1>
      <p className="text-zinc-500 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link
        href="/workspace/ws-001/dashboard"
        className="inline-flex h-8 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}

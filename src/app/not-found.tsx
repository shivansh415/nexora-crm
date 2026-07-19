import Link from 'next/link'
import { MessageSquare, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-5 overflow-hidden px-4 text-center" style={{ backgroundColor: 'var(--wa-bg)' }}>
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />

      <div className="relative flex size-14 items-center justify-center rounded-2xl text-white shadow-lg" style={{ backgroundImage: 'var(--brand-gradient)', boxShadow: 'var(--brand-glow)' }}>
        <MessageSquare className="size-7" strokeWidth={2.2} />
      </div>

      <p className="relative text-[88px] font-extrabold leading-none tracking-tight brand-gradient-text">404</p>

      <div className="relative space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Page not found</h1>
        <p className="mx-auto max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
        </p>
      </div>

      <Link
        href="/workspace/ws-001/dashboard"
        className="relative mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
        style={{ backgroundImage: 'var(--brand-gradient)', boxShadow: 'var(--brand-glow)' }}
      >
        <ArrowLeft className="size-4" /> Back to Dashboard
      </Link>
    </div>
  )
}

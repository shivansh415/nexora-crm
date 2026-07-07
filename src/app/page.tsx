// Root page — demo mode redirects to workspace in proxy.ts
// Real auth mode redirects to /login
// This page is never directly shown

export default function RootPage() {
  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--wa-bg)' }}>
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-full animate-pulse" style={{ backgroundColor: 'var(--wa-green)' }} />
        <span className="text-sm" style={{ color: 'var(--wa-text-secondary)' }}>Loading...</span>
      </div>
    </div>
  )
}

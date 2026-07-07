// Auth layout — no sidebar, just the auth UI
// Uses global WhatsApp theme from globals.css

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--wa-bg)' }}>
      {children}
    </div>
  )
}

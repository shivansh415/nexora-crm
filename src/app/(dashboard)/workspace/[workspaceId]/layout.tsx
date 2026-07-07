import Sidebar from '@/components/layout/sidebar'
import MobileNav from '@/components/layout/mobile-nav'

interface DashboardLayoutProps {
  children: React.ReactNode
  params: Promise<{ workspaceId: string }>
}

export default async function DashboardLayout({ children, params }: DashboardLayoutProps) {
  // In demo mode, workspaceId comes from URL
  const { workspaceId } = await params

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar workspaceId={workspaceId} />
      </div>

      {/* Main content */}
      <main
        className="min-h-screen pb-16 md:pb-0"
        style={{ marginLeft: '0' }}
      >
        <div className="md:pl-[var(--sidebar-width)]">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileNav workspaceId={workspaceId} />
    </div>
  )
}

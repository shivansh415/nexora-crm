'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Target,
  Users,
  CalendarDays,
  BarChart3,
  Settings,
  Inbox,
  ChevronDown,
  ChevronUp,
  Building2,
  LogOut,
  User,
  Check,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

// Nav grouped into sections for clearer hierarchy (labels are display-only).
const NAV_SECTIONS: { section: string; items: { label: string; href: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', href: 'dashboard', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Engage',
    items: [
      { label: 'Chats',        href: 'chats',        icon: MessageSquare },
      { label: 'Broadcast',    href: 'broadcast',    icon: Megaphone },
      { label: 'Enquiries',    href: 'enquiries',    icon: Inbox },
    ],
  },
  {
    section: 'Manage',
    items: [
      { label: 'Leads',        href: 'leads',        icon: Target },
      { label: 'Contacts',     href: 'contacts',     icon: Users },
      { label: 'Appointments', href: 'appointments', icon: CalendarDays },
    ],
  },
  {
    section: 'Insights',
    items: [
      { label: 'Analytics',    href: 'analytics',    icon: BarChart3 },
      { label: 'Settings',     href: 'settings',     icon: Settings },
    ],
  },
]

interface SidebarProps {
  workspaceId: string
}

interface SidebarUser {
  full_name: string
  email: string
}

interface SidebarWorkspace {
  id: string
  name: string
  business_type: string
  ai_enabled: boolean
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handler()
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [ref, handler])
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function Sidebar({ workspaceId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [workspaces, setWorkspaces] = useState<SidebarWorkspace[]>([])
  const [currentUser, setCurrentUser] = useState<SidebarUser | null>(null)
  const [loading, setLoading] = useState(true)

  const currentWorkspace = workspaces.find((w) => w.id === workspaceId)

  const [wsOpen, setWsOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const wsRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useClickOutside(wsRef, () => setWsOpen(false))
  useClickOutside(userRef, () => setUserOpen(false))

  // Fetch user and workspaces on mount
  useEffect(() => {
    async function load() {
      try {
        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setCurrentUser({
            full_name: (user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || 'User',
            email: user.email || '',
          })

          // Fetch workspaces the user is a member of
          const { data: memberships } = await supabase
            .from('user_workspace_memberships')
            .select('workspace_id')
            .eq('user_id', user.id) as { data: Array<{ workspace_id: string }> | null; error: unknown }

          if (memberships && memberships.length > 0) {
            const wsIds = memberships.map((m) => m.workspace_id)
            const { data: wsData } = await supabase
              .from('workspaces')
              .select('id, name, business_type, ai_enabled')
              .in('id', wsIds) as { data: SidebarWorkspace[] | null; error: unknown }

            if (wsData) {
              setWorkspaces(wsData)
            }
          }
        }
      } catch (err) {
        console.error('[sidebar] Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  async function handleSignOut() {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }
    router.push('/login')
  }

  function navigateWorkspace(id: string) {
    setWsOpen(false)
    router.push(`/workspace/${id}/dashboard`)
  }

  const displayName = currentUser?.full_name || 'User'
  const displayEmail = currentUser?.email || ''

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden md:flex flex-col"
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
      }}
    >
      {/* ── Brand ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <div
          className="relative flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-lg"
          style={{ backgroundImage: 'var(--brand-gradient)', boxShadow: 'var(--brand-glow)' }}
        >
          <MessageSquare className="size-[18px]" strokeWidth={2.4} />
          <span
            className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2"
            style={{ backgroundColor: 'var(--wa-green)', ['--tw-ring-color' as string]: 'var(--sidebar-bg)' }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold leading-none tracking-tight" style={{ color: 'var(--sidebar-text)' }}>
            Nexora
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: 'var(--sidebar-text-muted)' }}>
            WhatsApp CRM
          </p>
        </div>
      </div>

      {/* ── Workspace Switcher ─────────────────────────────────────────── */}
      <div ref={wsRef} className="relative px-3 pb-3">
        <button
          onClick={() => setWsOpen(!wsOpen)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors focus:outline-none"
          style={{
            backgroundColor: wsOpen ? 'var(--sidebar-active)' : 'var(--sidebar-hover)',
            border: '1px solid var(--sidebar-border)',
          }}
          onMouseEnter={(e) => { if (!wsOpen) e.currentTarget.style.backgroundColor = 'var(--sidebar-active)' }}
          onMouseLeave={(e) => { if (!wsOpen) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)' }}
        >
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
            style={{ backgroundImage: 'var(--brand-gradient)' }}
          >
            {getInitials(currentWorkspace?.name ?? 'WS')}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--sidebar-text)' }}>
              {currentWorkspace?.name ?? 'Select Workspace'}
            </p>
            <p className="truncate text-[10px] leading-tight capitalize" style={{ color: 'var(--sidebar-text-muted)' }}>
              {currentWorkspace?.business_type?.replace('_', ' ') ?? 'Agency'}
            </p>
          </div>
          {wsOpen
            ? <ChevronUp className="size-3.5 shrink-0" style={{ color: 'var(--sidebar-text-muted)' }} />
            : <ChevronDown className="size-3.5 shrink-0" style={{ color: 'var(--sidebar-text-muted)' }} />
          }
        </button>

        {/* Workspace dropdown panel */}
        {wsOpen && (
          <div
            className="absolute left-3 right-3 top-full z-50 mt-1 rounded-xl overflow-hidden py-1.5 animate-scale-in"
            style={{
              backgroundColor: 'var(--sidebar-active)',
              border: '1px solid var(--sidebar-border)',
              boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
              transformOrigin: 'top',
            }}
          >
            <div className="px-3 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sidebar-text-muted)' }}>
                Workspaces
              </p>
            </div>
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => navigateWorkspace(ws.id)}
                className="flex w-full items-center gap-2.5 px-3 py-2 transition-colors text-left"
                style={{ backgroundColor: 'transparent' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <div
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
                  style={ws.id === workspaceId ? { backgroundImage: 'var(--brand-gradient)' } : { backgroundColor: 'rgba(255,255,255,0.12)' }}
                >
                  {getInitials(ws.name)}
                </div>
                <span className="flex-1 truncate text-xs" style={{ color: 'var(--sidebar-text)' }}>{ws.name}</span>
                {ws.id === workspaceId && (
                  <Check className="size-3.5 shrink-0" style={{ color: 'var(--brand-light)' }} />
                )}
              </button>
            ))}
            <div className="mx-3 my-1 h-px" style={{ backgroundColor: 'var(--sidebar-border)' }} />
            <button
              className="flex w-full items-center gap-2.5 px-3 py-2 transition-colors"
              style={{ backgroundColor: 'transparent' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Building2 className="size-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--sidebar-text-muted)' }}>Manage all clients</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2 scrollbar-hide">
        {NAV_SECTIONS.map((group) => (
          <div key={group.section} className="mb-3">
            <p
              className="px-2.5 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--sidebar-text-muted)' }}
            >
              {group.section}
            </p>
            {group.items.map((item) => {
              const href = `/workspace/${workspaceId}/${item.href}`
              const isActive = pathname === href || pathname.startsWith(href + '/')
              const Icon = item.icon

              return (
                <Link
                  key={item.href}
                  href={href}
                  className="group relative flex items-center gap-3 rounded-lg px-2.5 h-9 text-[13px] font-medium transition-all mb-0.5"
                  style={{
                    backgroundImage: isActive
                      ? 'linear-gradient(90deg, rgba(249,115,22,0.20), rgba(249,115,22,0.05))'
                      : 'none',
                    color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)'
                      e.currentTarget.style.color = 'var(--sidebar-text)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                      e.currentTarget.style.color = 'var(--sidebar-text-muted)'
                    }
                  }}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full"
                      style={{ backgroundImage: 'var(--brand-gradient)' }}
                    />
                  )}
                  <Icon
                    className="size-[18px] shrink-0 transition-colors"
                    style={{ color: isActive ? 'var(--brand-light)' : 'inherit' }}
                    strokeWidth={isActive ? 2.4 : 2}
                  />
                  <span className="flex-1 truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* ── AI Status ───────────────────────────────────────────────────── */}
      {currentWorkspace && (
        <div className="px-3 pb-2">
          <div
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
            style={{
              backgroundColor: currentWorkspace.ai_enabled ? 'rgba(18,161,80,0.12)' : 'var(--sidebar-hover)',
              border: `1px solid ${currentWorkspace.ai_enabled ? 'rgba(18,161,80,0.25)' : 'var(--sidebar-border)'}`,
            }}
          >
            <span className="relative flex size-2.5 shrink-0">
              {currentWorkspace.ai_enabled && (
                <span
                  className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                  style={{ backgroundColor: 'var(--wa-green)' }}
                />
              )}
              <span
                className="relative inline-flex size-2.5 rounded-full"
                style={{ backgroundColor: currentWorkspace.ai_enabled ? 'var(--wa-green)' : 'var(--sidebar-text-muted)' }}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold leading-tight" style={{ color: currentWorkspace.ai_enabled ? '#4ade80' : 'var(--sidebar-text-muted)' }}>
                AI Agent {currentWorkspace.ai_enabled ? 'Active' : 'Disabled'}
              </p>
              <p className="text-[10px] leading-tight" style={{ color: 'var(--sidebar-text-muted)' }}>
                {currentWorkspace.ai_enabled ? 'Auto-replying to chats' : 'Manual mode'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Theme Toggle ────────────────────────────────────────────────── */}
      <div className="px-3 pb-2">
        <ThemeToggle variant="pill" className="w-full" />
      </div>

      {/* ── User Profile ─────────────────────────────────────────────────── */}
      <div
        ref={userRef}
        className="relative p-3"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        {userOpen && (
          <div
            className="absolute bottom-full left-3 right-3 mb-1.5 rounded-xl overflow-hidden py-1.5 animate-scale-in"
            style={{
              backgroundColor: 'var(--sidebar-active)',
              border: '1px solid var(--sidebar-border)',
              boxShadow: '0 -12px 32px rgba(0,0,0,0.5)',
              transformOrigin: 'bottom',
              zIndex: 50,
            }}
          >
            <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--sidebar-text-muted)' }}>
                Account
              </p>
            </div>
            {[
              { label: 'Profile', icon: User, action: () => setUserOpen(false) },
              { label: 'Agency Settings', icon: Building2, action: () => setUserOpen(false) },
            ].map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                onClick={action}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors"
                style={{ color: 'var(--sidebar-text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Icon className="size-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
                {label}
              </button>
            ))}
            <div className="mx-3 my-1 h-px" style={{ backgroundColor: 'var(--sidebar-border)' }} />
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-xs transition-colors"
              style={{ color: '#f87171' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        )}

        <button
          onClick={() => setUserOpen(!userOpen)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors focus:outline-none"
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundImage: 'var(--brand-gradient)' }}
          >
            {getInitials(displayName)}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold" style={{ color: 'var(--sidebar-text)' }}>
              {displayName}
            </p>
            <p className="truncate text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>
              {displayEmail}
            </p>
          </div>
          {userOpen
            ? <ChevronUp className="size-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
            : <ChevronDown className="size-3.5" style={{ color: 'var(--sidebar-text-muted)' }} />
          }
        </button>
      </div>
    </aside>
  )
}

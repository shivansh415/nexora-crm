'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard,
  MessageSquare,
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
  Sparkles,
  User,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { label: 'Dashboard',     href: 'dashboard',      icon: LayoutDashboard },
  { label: 'Chats',         href: 'chats',           icon: MessageSquare },
  { label: 'Leads',         href: 'leads',           icon: Target },
  { label: 'Contacts',      href: 'contacts',        icon: Users },
  { label: 'Appointments',  href: 'appointments',    icon: CalendarDays },
  { label: 'Enquiries',     href: 'enquiries',       icon: Inbox },
  { label: 'Analytics',     href: 'analytics',       icon: BarChart3 },
  { label: 'Settings',      href: 'settings',        icon: Settings },
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
          const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
          const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

          // Use REST to get memberships joined with workspaces
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
      {/* ── Workspace Switcher ─────────────────────────────────────────── */}
      <div
        ref={wsRef}
        className="relative"
        style={{ borderBottom: '1px solid var(--sidebar-border)' }}
      >
        <button
          onClick={() => setWsOpen(!wsOpen)}
          className="flex w-full items-center gap-2.5 px-3 py-3.5 transition-colors focus:outline-none"
          style={{ backgroundColor: wsOpen ? 'var(--sidebar-hover)' : 'transparent' }}
          onMouseEnter={(e) => { if (!wsOpen) e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)' }}
          onMouseLeave={(e) => { if (!wsOpen) e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          {/* Workspace icon */}
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ backgroundColor: 'var(--wa-green)' }}
          >
            {getInitials(currentWorkspace?.name ?? 'WS')}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold leading-tight" style={{ color: 'var(--sidebar-text)' }}>
              {currentWorkspace?.name ?? 'Select Workspace'}
            </p>
            <p className="text-[10px] leading-tight capitalize" style={{ color: 'var(--sidebar-text-muted)' }}>
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
            className="absolute left-0 right-0 top-full z-50 rounded-b-xl overflow-hidden py-1"
            style={{
              backgroundColor: 'var(--sidebar-active)',
              borderTop: '1px solid var(--sidebar-border)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {/* Label */}
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
                  className="flex size-6 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                  style={{ backgroundColor: ws.id === workspaceId ? 'var(--wa-green)' : 'rgba(255,255,255,0.15)' }}
                >
                  {getInitials(ws.name)}
                </div>
                <span className="flex-1 truncate text-xs" style={{ color: 'var(--sidebar-text)' }}>{ws.name}</span>
                {ws.id === workspaceId && (
                  <Check className="size-3 shrink-0" style={{ color: 'var(--wa-green)' }} />
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
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map((item) => {
          const href = `/workspace/${workspaceId}/${item.href}`
          const isActive = pathname === href || pathname.startsWith(href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={href}
              className="group flex items-center gap-2.5 rounded-lg px-2.5 h-9 text-sm font-medium transition-all mb-0.5"
              style={{
                backgroundColor: isActive ? 'var(--sidebar-active)' : 'transparent',
                color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-text-muted)',
                borderLeft: isActive ? '3px solid var(--wa-green)' : '3px solid transparent',
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
              <Icon className="size-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* ── Theme Toggle ────────────────────────────────────────────────── */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
        <ThemeToggle variant="pill" className="w-full" />
      </div>

      {/* ── AI Status ───────────────────────────────────────────────────── */}
      {currentWorkspace && (
        <div className="px-3 pb-2">
          <div
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
            style={{
              backgroundColor: currentWorkspace.ai_enabled ? 'rgba(0,168,132,0.12)' : 'rgba(255,255,255,0.05)',
              color: currentWorkspace.ai_enabled ? 'var(--wa-green)' : 'var(--sidebar-text-muted)',
            }}
          >
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: currentWorkspace.ai_enabled ? 'var(--wa-green)' : 'var(--sidebar-text-muted)' }}
            />
            <span className="font-medium">AI {currentWorkspace.ai_enabled ? 'Active' : 'Disabled'}</span>
          </div>
        </div>
      )}

      {/* ── User Profile ─────────────────────────────────────────────────── */}
      <div
        ref={userRef}
        className="relative p-2"
        style={{ borderTop: '1px solid var(--sidebar-border)' }}
      >
        {/* User menu panel — renders ABOVE the trigger, inside sidebar */}
        {userOpen && (
          <div
            className="absolute bottom-full left-2 right-2 mb-1 rounded-xl overflow-hidden py-1"
            style={{
              backgroundColor: 'var(--sidebar-active)',
              border: '1px solid var(--sidebar-border)',
              boxShadow: '0 -8px 24px rgba(0,0,0,0.4)',
              zIndex: 50,
            }}
          >
            {/* Header */}
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
              style={{ color: '#ef4444' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <LogOut className="size-3.5" />
              Sign out
            </button>
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={() => setUserOpen(!userOpen)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors focus:outline-none"
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--sidebar-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--wa-green)' }}
          >
            {getInitials(displayName)}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-medium" style={{ color: 'var(--sidebar-text)' }}>
              {displayName}
            </p>
            <p className="truncate text-[10px]" style={{ color: 'var(--sidebar-text-muted)' }}>
              {displayEmail}
            </p>
          </div>
          {userOpen
            ? <ChevronUp className="size-3" style={{ color: 'var(--sidebar-text-muted)' }} />
            : <ChevronDown className="size-3" style={{ color: 'var(--sidebar-text-muted)' }} />
          }
        </button>
      </div>
    </aside>
  )
}

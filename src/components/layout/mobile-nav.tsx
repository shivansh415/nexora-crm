'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  Megaphone,
  Target,
  BarChart3,
  MoreHorizontal,
  Users,
  CalendarDays,
  Settings,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'

const BOTTOM_NAV = [
  { label: 'Chats',   href: 'chats',     icon: MessageSquare, badge: 4 },
  { label: 'Leads',   href: 'leads',     icon: Target },
  { label: 'Stats',   href: 'analytics', icon: BarChart3 },
  { label: 'More',    href: null,        icon: MoreHorizontal },
]

const MORE_ITEMS = [
  { label: 'Dashboard',     href: 'dashboard',      icon: LayoutDashboard },
  { label: 'Broadcast',     href: 'broadcast',      icon: Megaphone },
  { label: 'Contacts',      href: 'contacts',       icon: Users },
  { label: 'Appointments',  href: 'appointments',   icon: CalendarDays },
  { label: 'Enquiries',     href: 'enquiries',      icon: Inbox },
  { label: 'Settings',      href: 'settings',       icon: Settings },
]

interface MobileNavProps {
  workspaceId: string
}

export default function MobileNav({ workspaceId }: MobileNavProps) {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center border-t border-zinc-200 bg-white/90 backdrop-blur-xl mobile-nav-safe md:hidden dark:border-zinc-800"
      style={{ height: 'var(--mobile-nav-height)' }}
    >
      {BOTTOM_NAV.map((item) => {
        if (item.href === null) {
          return (
            <Sheet key="more">
              <SheetTrigger className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-zinc-500 dark:text-zinc-400">
                <div className="flex size-9 items-center justify-center rounded-xl">
                  <item.icon className="size-[22px]" />
                </div>
                <span className="text-[10px] font-medium -mt-1">More</span>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-3xl bg-white dark:bg-zinc-900 border-t-0">
                <SheetHeader className="pb-4">
                  <SheetTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Menu
                  </SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {MORE_ITEMS.map((more) => {
                    const href = `/workspace/${workspaceId}/${more.href}`
                    const isActive = pathname.startsWith(href)
                    const Icon = more.icon
                    return (
                      <Link
                        key={more.href}
                        href={href}
                        className={cn(
                          'flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all',
                          isActive
                            ? 'border-orange-200 bg-orange-50 dark:border-orange-500/30 dark:bg-orange-500/10'
                            : 'border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/60'
                        )}
                      >
                        <div className={cn(
                          'flex size-11 items-center justify-center rounded-xl transition-colors',
                          isActive
                            ? 'text-white shadow-md'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        )}
                        style={isActive ? { backgroundImage: 'var(--brand-gradient)' } : undefined}
                        >
                          <Icon className="size-5" />
                        </div>
                        <span className={cn(
                          'text-[11px] font-semibold leading-tight',
                          isActive ? 'text-orange-700 dark:text-orange-300' : 'text-zinc-700 dark:text-zinc-300'
                        )}>
                          {more.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold uppercase tracking-wider mb-2 px-1">
                    Appearance
                  </p>
                  <ThemeToggle variant="pill" className="w-full !bg-zinc-100 dark:!bg-zinc-800" />
                </div>
              </SheetContent>
            </Sheet>
          )
        }

        const href = `/workspace/${workspaceId}/${item.href}`
        const isActive = pathname === href || pathname.startsWith(href + '/')
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={href}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors"
          >
            <div
              className={cn(
                'flex size-9 items-center justify-center rounded-xl transition-all',
                isActive ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400 dark:text-zinc-500'
              )}
              style={isActive ? { backgroundColor: 'var(--brand-soft)' } : undefined}
            >
              <div className="relative">
                <Icon className="size-[22px]" strokeWidth={isActive ? 2.4 : 2} />
                {item.badge && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex min-w-4 h-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900"
                    style={{ backgroundImage: 'var(--brand-gradient)' }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            </div>
            <span className={cn(
              'text-[10px] font-semibold -mt-1',
              isActive ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400 dark:text-zinc-500'
            )}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

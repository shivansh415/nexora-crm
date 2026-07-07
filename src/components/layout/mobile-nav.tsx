'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
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
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 mobile-nav-safe md:hidden"
      style={{ height: 'var(--mobile-nav-height)' }}
    >
      {BOTTOM_NAV.map((item) => {
        if (item.href === null) {
          return (
            <Sheet key="more">
              <SheetTrigger className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-zinc-500 dark:text-zinc-400">
                <item.icon className="size-5" />
                <span className="text-[10px] font-medium">More</span>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl bg-white dark:bg-zinc-900">
                <SheetHeader className="pb-4">
                  <SheetTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Menu
                  </SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {MORE_ITEMS.map((more) => {
                    const href = `/workspace/${workspaceId}/${more.href}`
                    const isActive = pathname.startsWith(href)
                    const Icon = more.icon
                    return (
                      <Link
                        key={more.href}
                        href={href}
                        className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-100 dark:border-zinc-800 p-3 text-center transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      >
                        <div className={cn(
                          'flex size-10 items-center justify-center rounded-lg',
                          isActive
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                        )}>
                          <Icon className="size-5" />
                        </div>
                        <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300 leading-tight">
                          {more.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
                {/* Theme toggle inside the sheet */}
                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wide mb-2 px-1">
                    Theme
                  </p>
                  <ThemeToggle variant="pill" className="w-full" />
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
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors',
              isActive
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
            )}
          >
            <div className="relative">
              <Icon className="size-5" />
              {item.badge && !isActive && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 text-[9px] font-bold text-white dark:text-zinc-900">
                  {item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
            {isActive && (
              <span style={{ background: 'var(--wa-green)' }} className="absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

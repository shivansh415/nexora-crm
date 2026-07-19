'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'

type ThemeOption = 'light' | 'dark' | 'system'

const OPTIONS: { value: ThemeOption; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
]

interface ThemeToggleProps {
  /** 'pill' = 3-segment pill (sidebar use), 'icon' = single icon button */
  variant?: 'pill' | 'icon'
  className?: string
}

export function ThemeToggle({ variant = 'pill', className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after mount
  useEffect(() => setMounted(true), [])
  if (!mounted) {
    if (variant === 'icon') return <div className={cn('size-7 rounded-md bg-transparent', className)} />
    return <div className={cn('h-7 w-full rounded-full bg-zinc-100 dark:bg-zinc-800', className)} />
  }

  // ── Icon variant (compact single button) ──────────────────────────────────
  if (variant === 'icon') {
    const isDark = resolvedTheme === 'dark'
    return (
      <button
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className={cn(
          'flex size-7 items-center justify-center rounded-md transition-colors',
          'hover:bg-zinc-100 dark:hover:bg-zinc-800',
          'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
          className
        )}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>
    )
  }

  // ── Pill variant (3-segment: Light / System / Dark) ───────────────────────
  return (
    <div
      className={cn('flex items-center gap-0.5 rounded-full p-0.5', className)}
      style={{ backgroundColor: 'var(--sidebar-hover)' }}
      role="group"
      aria-label="Theme selection"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const isActive = theme === value
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all duration-150"
            style={{
              backgroundImage: isActive ? 'var(--brand-gradient)' : 'none',
              backgroundColor: isActive ? 'var(--brand)' : 'transparent',
              color: isActive ? '#ffffff' : 'var(--sidebar-text-muted)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--sidebar-text)'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = 'var(--sidebar-text-muted)'
            }}
            aria-pressed={isActive}
            title={`${label} mode`}
          >
            <Icon className="size-3" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Target,
  CalendarDays,
  Bot,
  ArrowRight,
  Inbox,
  Zap,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { createClient } from '@supabase/supabase-js'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

const PIPELINE_STAGES = [
  { id: 'new', label: 'New', color: 'bg-zinc-400' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-amber-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-violet-500' },
  { id: 'won', label: 'Won', color: 'bg-emerald-500' },
]

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function getVariedGreeting(hour: number): string {
  // Different greetings for different times of day, rotating randomly
  const morningGreetings = ['Good morning', 'Rise and shine', 'Happy morning', 'Top of the morning']
  const afternoonGreetings = ['Good afternoon', 'Afternoon', 'Keep up the momentum', 'Productive afternoon']
  const eveningGreetings = ['Good evening', 'Evening', 'Winding down', 'Good to see you']

  let greetings: string[]
  if (hour < 12) {
    greetings = morningGreetings
  } else if (hour < 17) {
    greetings = afternoonGreetings
  } else {
    greetings = eveningGreetings
  }

  // Use the IST date as seed for a consistent greeting throughout the day
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const seed = Number(parts.replace(/-/g, ''))
  const index = seed % greetings.length
  return greetings[index]
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function DashboardPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = getAdminSupabase()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)

  // ── Live stats ──
  const [
    { count: newChatsToday },
    { count: newChatsYesterday },
    { count: msgToday },
    { count: aiMsgToday },
    { count: outboundToday },
    { data: leads },
    { count: newLeadsToday },
    { count: appointmentCount },
    { data: conversations },
  ] = await Promise.all([
    // New chats (conversations) started today
    supabase.from('conversations').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).gte('created_at', todayStart.toISOString()),
    // New chats started yesterday
    supabase.from('conversations').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()),
    // Inbound messages today (for activity panel)
    supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).eq('direction', 'inbound').gte('created_at', todayStart.toISOString()),
    // AI messages today
    supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).eq('is_ai_generated', true).gte('created_at', todayStart.toISOString()),
    // Total outbound today
    supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).eq('direction', 'outbound').gte('created_at', todayStart.toISOString()),
    // All leads with stage
    supabase.from('leads').select('id, stage').eq('workspace_id', workspaceId) as any,
    // New leads today
    supabase.from('leads').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).gte('created_at', todayStart.toISOString()),
    // Upcoming appointments
    supabase.from('appointments').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).in('status', ['scheduled', 'confirmed']),
    // Recent conversations with contacts
    supabase.from('conversations')
      .select('id, status, ai_paused, unread_count, last_message_at, last_message_preview, contacts(id, name, phone_number)')
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false })
      .limit(5) as any,
  ])

  const safeLeads = (leads ?? []) as Array<{ id: string; stage: string }>
  const safeConversations = (conversations ?? []) as Array<{
    id: string; status: string; ai_paused: boolean; unread_count: number;
    last_message_at: string | null; last_message_preview: string | null;
    contacts: { id: string; name: string; phone_number: string } | null
  }>

  const totalMsgToday = msgToday ?? 0
  const totalNewChatsToday = newChatsToday ?? 0
  const convDelta = totalNewChatsToday - (newChatsYesterday ?? 0)
  const activeLeads = safeLeads.filter((l) => !['won', 'lost'].includes(l.stage)).length
  const aiRate = (outboundToday ?? 0) > 0 ? Math.round(((aiMsgToday ?? 0) / (outboundToday ?? 1)) * 100) : 0

  // Compute the hour and date in IST so the server (UTC) renders the correct local day/time
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(new Date()),
  )
  const greeting = getVariedGreeting(hour)
  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date())

  // ── Stat card config ──
  const stats = [
    {
      label: 'New Chats Today',
      value: String(totalNewChatsToday),
      href: 'chats',
      icon: MessageSquare,
      accent: 'brand' as const,
      trend: { positive: convDelta >= 0, text: `${convDelta >= 0 ? '+' : ''}${convDelta} vs yesterday` },
    },
    {
      label: 'Active Leads',
      value: String(activeLeads),
      href: 'leads',
      icon: Target,
      accent: 'amber' as const,
      trend: { positive: true, text: `+${newLeadsToday ?? 0} new today` },
    },
    {
      label: 'Upcoming Appointments',
      value: String(appointmentCount ?? 0),
      href: 'appointments',
      icon: CalendarDays,
      accent: 'blue' as const,
      trend: null,
    },
    {
      label: 'AI Response Rate',
      value: `${aiRate}%`,
      href: 'analytics',
      icon: Bot,
      accent: 'green' as const,
      trend: { positive: true, text: 'AI handling replies' },
    },
  ]

  const accentStyles: Record<string, { icon: string; glow: string; iconStyle?: React.CSSProperties }> = {
    brand: { icon: 'text-white shadow-md', glow: 'bg-orange-500/15', iconStyle: { backgroundImage: 'var(--brand-gradient)' } },
    amber: { icon: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400', glow: 'bg-amber-400/15' },
    blue:  { icon: 'bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400', glow: 'bg-blue-400/15' },
    green: { icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400', glow: 'bg-emerald-400/15' },
  }

  return (
    <div className="mx-auto max-w-7xl p-5 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300">
            <Sparkles className="size-3" />
            AI Command Center
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-[28px]">
            {greeting}, Admin
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{dateStr}</p>
        </div>
        <Link
          href={`/workspace/${workspaceId}/broadcast`}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg"
          style={{ backgroundImage: 'var(--brand-gradient)', boxShadow: 'var(--brand-glow)' }}
        >
          <Zap className="size-4" />
          New Broadcast
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger">
        {stats.map((stat) => {
          const a = accentStyles[stat.accent]
          const Icon = stat.icon
          return (
            <Link key={stat.label} href={`/workspace/${workspaceId}/${stat.href}`} className="group">
              <div className="relative h-full overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg dark:border-zinc-800">
                <div className={cn('pointer-events-none absolute -right-8 -top-8 size-28 rounded-full blur-2xl', a.glow)} />
                <div className="relative flex items-start justify-between">
                  <div className={cn('flex size-11 items-center justify-center rounded-xl', a.icon)} style={a.iconStyle}>
                    <Icon className="size-[20px]" strokeWidth={2.2} />
                  </div>
                  {stat.trend && (
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold',
                      stat.trend.positive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                        : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                    )}>
                      {stat.trend.positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                      {stat.trend.text}
                    </span>
                  )}
                </div>
                <p className="relative mt-4 text-[34px] font-extrabold leading-none tracking-tight text-zinc-900 tabular-nums dark:text-zinc-100">
                  {stat.value}
                </p>
                <p className="relative mt-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {stat.label}
                </p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent Conversations */}
        <div className="lg:col-span-2">
          <div className="h-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <span className="flex size-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                  <MessageSquare className="size-3.5" />
                </span>
                Recent Conversations
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500 dark:bg-zinc-800">{safeConversations.length}</span>
              </h2>
              <Link href={`/workspace/${workspaceId}/chats`} className="group flex items-center gap-1 text-xs font-semibold text-orange-600 transition-colors hover:text-orange-700 dark:text-orange-400">
                View all <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {safeConversations.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                    <MessageSquare className="size-6 text-zinc-400" />
                  </div>
                  <p className="text-sm font-medium text-zinc-500">No conversations yet</p>
                  <p className="mt-1 text-xs text-zinc-400">Conversations appear here when customers message you</p>
                </div>
              ) : (
                safeConversations.map((conv) => {
                  const contactName = conv.contacts?.name ?? conv.contacts?.phone_number ?? 'Unknown'
                  const isAI = !conv.ai_paused && conv.status !== 'human_takeover'
                  return (
                    <Link
                      key={conv.id}
                      href={`/workspace/${workspaceId}/chats/${conv.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-orange-50/40 dark:hover:bg-zinc-800/50"
                    >
                      <Avatar className="size-10 shrink-0">
                        <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundImage: 'var(--brand-gradient)' }}>
                          {getInitials(contactName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('truncate text-sm', conv.unread_count > 0 ? 'font-bold text-zinc-900 dark:text-zinc-100' : 'font-semibold text-zinc-700 dark:text-zinc-300')}>
                            {contactName}
                          </p>
                          <span className="shrink-0 text-[11px] text-zinc-400">
                            {conv.last_message_at ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true }) : '—'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="flex-1 truncate text-xs text-zinc-500 dark:text-zinc-400">{conv.last_message_preview}</p>
                          <div className="flex items-center gap-1 shrink-0">
                            {isAI && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                                <Sparkles className="size-2.5" /> AI
                              </span>
                            )}
                            {conv.unread_count > 0 && (
                              <span className="flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundImage: 'var(--brand-gradient)' }}>
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-5">
          {/* Pipeline Summary */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <span className="flex size-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                  <Target className="size-3.5" />
                </span>
                Pipeline
              </h2>
              <Link href={`/workspace/${workspaceId}/leads`} className="group flex items-center gap-1 text-xs font-semibold text-orange-600 transition-colors hover:text-orange-700 dark:text-orange-400">
                View all <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="space-y-3 p-5">
              {PIPELINE_STAGES.map((stage) => {
                const count = safeLeads.filter((l) => l.stage === stage.id).length
                const total = safeLeads.length || 1
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={stage.id}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">{stage.label}</span>
                      <span className="font-semibold text-zinc-400 tabular-nums">{count}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div className={cn('h-2 rounded-full transition-all duration-500', stage.color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {safeLeads.length === 0 && (
                <p className="py-2 text-center text-xs text-zinc-400">No leads yet</p>
              )}
            </div>
          </div>

          {/* Today's Activity */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800">
            <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
              <h2 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                <span className="flex size-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400">
                  <Zap className="size-3.5" />
                </span>
                Today&apos;s Activity
              </h2>
            </div>
            <div className="space-y-1 p-3">
              {[
                { label: 'Inbound Messages', value: totalMsgToday, icon: Inbox, tint: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
                { label: 'AI Replies', value: aiMsgToday ?? 0, icon: Bot, tint: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
                { label: 'New Leads', value: newLeadsToday ?? 0, icon: Target, tint: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
                { label: 'Active Conversations', value: safeConversations.filter(c => c.status === 'active').length, icon: MessageSquare, tint: 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <span className={cn('flex size-8 items-center justify-center rounded-lg', item.tint)}>
                      <Icon className="size-4" />
                    </span>
                    <span className="flex-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">{item.label}</span>
                    <span className="text-sm font-bold text-zinc-900 tabular-nums dark:text-zinc-100">{item.value}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

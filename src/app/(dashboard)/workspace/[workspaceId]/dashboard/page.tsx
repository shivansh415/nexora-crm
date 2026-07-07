import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Target,
  CalendarDays,
  Bot,
  ArrowRight,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
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
  { id: 'proposal', label: 'Proposal', color: 'bg-purple-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
]

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
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
    { count: msgToday },
    { count: msgYesterday },
    { count: aiMsgToday },
    { count: outboundToday },
    { data: leads },
    { count: newLeadsToday },
    { count: appointmentCount },
    { data: conversations },
  ] = await Promise.all([
    // Messages today (inbound)
    supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).eq('direction', 'inbound').gte('created_at', todayStart.toISOString()),
    // Messages yesterday
    supabase.from('messages').select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId).eq('direction', 'inbound')
      .gte('created_at', yesterdayStart.toISOString()).lt('created_at', todayStart.toISOString()),
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
  const totalMsgYesterday = msgYesterday ?? 0
  const convDelta = totalMsgToday - totalMsgYesterday
  const activeLeads = safeLeads.filter((l) => !['won', 'lost'].includes(l.stage)).length
  const aiRate = (outboundToday ?? 0) > 0 ? Math.round(((aiMsgToday ?? 0) / (outboundToday ?? 1)) * 100) : 0

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {greeting}, Admin 👋
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {format(new Date(), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Messages Today */}
        <Link href={`/workspace/${workspaceId}/chats`} className="group">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Messages Today</p>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{totalMsgToday}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <MessageSquare className="size-4 text-zinc-500" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              {convDelta >= 0 ? <TrendingUp className="size-3 text-green-600" /> : <TrendingDown className="size-3 text-red-500" />}
              <span className={convDelta >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                {convDelta >= 0 ? '+' : ''}{convDelta} vs yesterday
              </span>
            </div>
          </div>
        </Link>

        {/* Active Leads */}
        <Link href={`/workspace/${workspaceId}/leads`} className="group">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Active Leads</p>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{activeLeads}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50">
                <Target className="size-4 text-amber-500" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              <TrendingUp className="size-3 text-green-600" />
              <span className="text-green-600 font-medium">+{newLeadsToday ?? 0} new today</span>
            </div>
          </div>
        </Link>

        {/* Appointments */}
        <Link href={`/workspace/${workspaceId}/appointments`} className="group">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Upcoming Appointments</p>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{appointmentCount ?? 0}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50">
                <CalendarDays className="size-4 text-blue-500" />
              </div>
            </div>
          </div>
        </Link>

        {/* AI Response Rate */}
        <Link href={`/workspace/${workspaceId}/analytics`} className="group">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">AI Response Rate</p>
                <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">{aiRate}%</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-green-50">
                <Bot className="size-4 text-green-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              <TrendingUp className="size-3 text-green-600" />
              <span className="text-green-600 font-medium">AI handling responses</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Conversations */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Recent Conversations
                <span className="ml-2 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-normal text-zinc-500">{safeConversations.length}</span>
              </h2>
              <Link href={`/workspace/${workspaceId}/chats`} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                View all <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {safeConversations.length === 0 ? (
                <div className="py-12 text-center">
                  <MessageSquare className="size-8 text-zinc-200 mx-auto mb-2" />
                  <p className="text-sm text-zinc-400">No conversations yet</p>
                  <p className="text-xs text-zinc-300 mt-1">Conversations will appear here when customers message you</p>
                </div>
              ) : (
                safeConversations.map((conv) => {
                  const contactName = conv.contacts?.name ?? conv.contacts?.phone_number ?? 'Unknown'
                  const isAI = !conv.ai_paused && conv.status !== 'human_takeover'
                  return (
                    <Link
                      key={conv.id}
                      href={`/workspace/${workspaceId}/chats/${conv.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="text-xs font-medium bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                          {getInitials(contactName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('truncate text-sm', conv.unread_count > 0 ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'font-medium text-zinc-700 dark:text-zinc-300')}>
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
                              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">AI</span>
                            )}
                            {conv.unread_count > 0 && (
                              <span className="flex size-4 items-center justify-center rounded-full bg-zinc-900 text-[9px] font-bold text-white">
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
        <div className="flex flex-col gap-6">
          {/* Pipeline Summary */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pipeline</h2>
              <Link href={`/workspace/${workspaceId}/leads`} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors">
                View all <ArrowRight className="size-3" />
              </Link>
            </div>
            <div className="p-4 space-y-2">
              {PIPELINE_STAGES.map((stage) => {
                const count = safeLeads.filter((l) => l.stage === stage.id).length
                const total = safeLeads.length || 1
                const pct = Math.round((count / total) * 100)
                return (
                  <div key={stage.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">{stage.label}</span>
                      <span className="text-zinc-500">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div className={cn('h-1.5 rounded-full', stage.color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              {safeLeads.length === 0 && (
                <p className="text-xs text-zinc-400 text-center py-2">No leads yet</p>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="border-b border-zinc-100 dark:border-zinc-800 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Today&apos;s Activity</h2>
            </div>
            <div className="p-4 space-y-3">
              {[
                { label: 'Inbound Messages', value: totalMsgToday, icon: '📩' },
                { label: 'AI Replies', value: aiMsgToday ?? 0, icon: '🤖' },
                { label: 'New Leads', value: newLeadsToday ?? 0, icon: '🎯' },
                { label: 'Active Conversations', value: safeConversations.filter(c => c.status === 'active').length, icon: '💬' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{item.icon} {item.label}</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

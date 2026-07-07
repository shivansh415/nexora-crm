import {
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Target,
  CalendarDays,
  Bot,
  ArrowRight,
  Clock,
  Zap,
  UserRound,
} from 'lucide-react'
import Link from 'next/link'
import { format, formatDistanceToNow } from 'date-fns'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { LeadStatus } from '@/types'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

const PIPELINE_STAGES: { id: LeadStatus; label: string; color: string }[] = [
  { id: 'new', label: 'New', color: 'bg-zinc-400' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-500' },
  { id: 'qualified', label: 'Qualified', color: 'bg-amber-500' },
  { id: 'proposal', label: 'Proposal', color: 'bg-purple-500' },
  { id: 'won', label: 'Won', color: 'bg-green-500' },
]

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function getAiModeBadge(aiPaused: boolean, status: string) {
  if (status === 'human_takeover') return { label: 'Agent', className: 'bg-blue-100 text-blue-700' }
  if (!aiPaused) return { label: 'AI', className: 'bg-green-100 text-green-700' }
  if (aiPaused) return { label: 'Paused', className: 'bg-amber-100 text-amber-700' }
  return { label: 'Resolved', className: 'bg-zinc-100 text-zinc-500' }
}

function formatCurrency(value: number, currency = 'INR') {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
  return `₹${value}`
}

export default async function DashboardPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  // Fetch auth user for greeting
  const { data: { user } } = await supabase.auth.getUser()
  const userName = (user?.user_metadata?.name as string) || (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'there'

  // Fetch recent conversations with contact info
  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, workspace_id, contact_id, status, ai_paused, unread_count, last_message_at, last_message_preview, created_at, contacts(id, name, phone_number)')
    .eq('workspace_id', workspaceId)
    .order('last_message_at', { ascending: false })
    .limit(5) as { data: Array<{
      id: string; workspace_id: string; contact_id: string; status: string;
      ai_paused: boolean; unread_count: number; last_message_at: string | null;
      last_message_preview: string | null; created_at: string;
      contacts: { id: string; name: string; phone_number: string } | null;
    }> | null; error: unknown }

  // Fetch leads for pipeline
  const { data: leads } = await supabase
    .from('leads')
    .select('id, stage, deal_value')
    .eq('workspace_id', workspaceId) as { data: Array<{ id: string; stage: string; deal_value: number | null }> | null; error: unknown }

  // Fetch analytics summaries (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const { data: analytics } = await supabase
    .from('analytics_summaries')
    .select('*')
    .eq('workspace_id', workspaceId)
    .gte('date', sevenDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true }) as { data: Array<{
      date: string; total_messages_in: number; total_messages_out: number;
      ai_messages_out: number; agent_messages_out: number; new_leads: number;
      new_appointments: number; human_takeovers: number;
    }> | null; error: unknown }

  // Fetch appointment count
  const { count: appointmentCount } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .in('status', ['scheduled', 'confirmed']) as { count: number | null; error: unknown }

  const recentAnalytics = analytics ?? []
  const safeConversations = conversations ?? []
  const safeLeads = leads ?? []

  // Compute stats
  const today = recentAnalytics[recentAnalytics.length - 1]
  const yesterday = recentAnalytics[recentAnalytics.length - 2]

  const totalConversationsToday = today?.total_messages_in ?? 0
  const totalConversationsYesterday = yesterday?.total_messages_in ?? 0
  const convDelta = totalConversationsToday - totalConversationsYesterday

  const activeLeads = safeLeads.filter((l) => !['won', 'lost'].includes(l.stage)).length
  const newLeadsToday = today?.new_leads ?? 0

  const aiRate = today
    ? (today.total_messages_out > 0 ? Math.round((today.ai_messages_out / today.total_messages_out) * 100) : 0)
    : 0
  const aiRateYesterday = yesterday
    ? (yesterday.total_messages_out > 0 ? Math.round((yesterday.ai_messages_out / yesterday.total_messages_out) * 100) : 0)
    : 0
  const aiRateDelta = aiRate - aiRateYesterday

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {greeting}, {userName.split(' ')[0]} 👋
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
                <p className="mt-2 text-3xl font-bold text-zinc-900 count-up">{totalConversationsToday}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <MessageSquare className="size-4 text-zinc-500 dark:text-zinc-400" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              {convDelta >= 0 ? (
                <TrendingUp className="size-3 text-green-600" />
              ) : (
                <TrendingDown className="size-3 text-red-500" />
              )}
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
                <p className="mt-2 text-3xl font-bold text-zinc-900 count-up">{activeLeads}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50">
                <Target className="size-4 text-amber-500" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              <TrendingUp className="size-3 text-green-600" />
              <span className="text-green-600 font-medium">+{newLeadsToday} new today</span>
            </div>
          </div>
        </Link>

        {/* Appointments */}
        <Link href={`/workspace/${workspaceId}/appointments`} className="group">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 transition-shadow hover:shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Upcoming Appointments</p>
                <p className="mt-2 text-3xl font-bold text-zinc-900 count-up">{appointmentCount ?? 0}</p>
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
                <p className="mt-2 text-3xl font-bold text-zinc-900 count-up">{aiRate}%</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg bg-green-50">
                <Bot className="size-4 text-green-600" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              {aiRateDelta >= 0 ? (
                <TrendingUp className="size-3 text-green-600" />
              ) : (
                <TrendingDown className="size-3 text-red-500" />
              )}
              <span className={aiRateDelta >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                {aiRateDelta >= 0 ? '+' : ''}{aiRateDelta}% vs yesterday
              </span>
            </div>
          </div>
        </Link>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Conversations */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Conversations</h2>
              <Link
                href={`/workspace/${workspaceId}/chats`}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
              >
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
                  const badge = getAiModeBadge(conv.ai_paused, conv.status)
                  return (
                    <Link
                      key={conv.id}
                      href={`/workspace/${workspaceId}/chats/${conv.id}`}
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-zinc-50"
                    >
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback className="text-xs font-medium bg-zinc-200 text-zinc-700">
                          {getInitials(contactName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {contactName}
                          </p>
                          <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500">
                            {conv.last_message_at
                              ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
                              : '—'}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <p className="flex-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {conv.last_message_preview}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                              badge.className
                            )}>
                              {badge.label}
                            </span>
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
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pipeline</h2>
              <Link
                href={`/workspace/${workspaceId}/leads`}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors"
              >
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
                      <span className="font-medium text-zinc-700">{stage.label}</span>
                      <span className="text-zinc-500">{count}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className={cn('h-1.5 rounded-full', stage.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Activity Feed — empty state placeholder */}
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent Activity</h2>
            </div>
            <div className="py-8 text-center">
              <Zap className="size-6 text-zinc-200 mx-auto mb-2" />
              <p className="text-xs text-zinc-400">Activity will show as you use the CRM</p>
            </div>
          </div>
        </div>
      </div>

      {/* Message Volume Sparkline */}
      {recentAnalytics.length > 0 && (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Message Volume — Last 7 Days</h2>
            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-zinc-900" />Inbound</span>
              <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full bg-green-500" />Outbound</span>
            </div>
          </div>
          <div className="flex items-end gap-1 h-16">
            {recentAnalytics.map((d, i) => {
              const maxIn = Math.max(...recentAnalytics.map((r) => r.total_messages_in))
              const maxOut = Math.max(...recentAnalytics.map((r) => r.total_messages_out))
              const max = Math.max(maxIn, maxOut, 1)
              return (
                <div key={i} className="flex flex-1 items-end gap-0.5">
                  <div
                    className="flex-1 rounded-sm bg-zinc-200"
                    style={{ height: `${(d.total_messages_in / max) * 100}%` }}
                    title={`Inbound: ${d.total_messages_in}`}
                  />
                  <div
                    className="flex-1 rounded-sm bg-green-400"
                    style={{ height: `${(d.total_messages_out / max) * 100}%` }}
                    title={`Outbound: ${d.total_messages_out}`}
                  />
                </div>
              )
            })}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
            {recentAnalytics.map((d, i) => (
              <span key={i}>{format(new Date(d.date), 'EEE')}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

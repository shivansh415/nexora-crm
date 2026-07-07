'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { Download, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const RANGES = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days'] as const
type Range = typeof RANGES[number]

interface AnalyticsSummary {
  date: string
  total_messages_in: number
  total_messages_out: number
  ai_messages_out: number
  agent_messages_out: number
  new_leads: number
  new_appointments: number
  human_takeovers: number
}

interface AnalyticsClientProps {
  data: AnalyticsSummary[]
}

function getRangeData(all: AnalyticsSummary[], range: Range) {
  if (range === 'Today') return all.slice(-1)
  if (range === 'Yesterday') return all.slice(-2, -1)
  if (range === 'Last 7 days') return all.slice(-7)
  return all
}

export default function AnalyticsClient({ data }: AnalyticsClientProps) {
  const [range, setRange] = useState<Range>('Last 7 days')
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const rangeData = getRangeData(data, range)

  // Recharts colors that adapt to theme
  const chartColors = {
    grid: isDark ? '#27272a' : '#f4f4f5',
    axis: isDark ? '#71717a' : '#a1a1aa',
    tooltip: isDark
      ? { background: '#18181b', border: '#27272a' }
      : { background: '#ffffff', border: '#e4e4e7' },
  }

  const totals = rangeData.reduce(
    (acc, d) => ({
      messages: acc.messages + d.total_messages_in + d.total_messages_out,
      leads: acc.leads + d.new_leads,
      appointments: acc.appointments + d.new_appointments,
      aiMessages: acc.aiMessages + d.ai_messages_out,
      agentMessages: acc.agentMessages + d.agent_messages_out,
      takeovers: acc.takeovers + d.human_takeovers,
    }),
    { messages: 0, leads: 0, appointments: 0, aiMessages: 0, agentMessages: 0, takeovers: 0 }
  )

  const aiRate = totals.aiMessages + totals.agentMessages > 0
    ? Math.round((totals.aiMessages / (totals.aiMessages + totals.agentMessages)) * 100)
    : 0

  const chartData = rangeData.map((d) => ({
    date: format(new Date(d.date), rangeData.length <= 7 ? 'EEE' : 'MMM d'),
    inbound: d.total_messages_in,
    outbound: d.total_messages_out,
    leads: d.new_leads,
    appointments: d.new_appointments,
  }))

  const pieData = [
    { name: 'AI', value: totals.aiMessages, color: '#16A34A' },
    { name: 'Agent', value: totals.agentMessages, color: '#2563EB' },
  ]

  // Empty state
  if (data.length === 0) {
    return (
      <div className="p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-zinc-900">Analytics</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Performance overview</p>
        </div>
        <div className="rounded-lg border border-dashed border-zinc-200 py-20 text-center">
          <BarChart3 className="size-12 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500">No analytics data yet</p>
          <p className="text-xs text-zinc-400 mt-1">Analytics will populate as messages flow through the system</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Analytics</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Performance overview</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Download className="size-3.5" /> Export
        </Button>
      </div>

      {/* Range Selector */}
      <div className="mb-6 flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              range === r ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          { label: 'Total Messages', value: totals.messages, color: 'text-zinc-900' },
          { label: 'New Leads', value: totals.leads, color: 'text-amber-600' },
          { label: 'Appointments Booked', value: totals.appointments, color: 'text-blue-600' },
          { label: 'AI Response Rate', value: `${aiRate}%`, color: 'text-green-600' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{stat.label}</p>
            <p className={`mt-2 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Messages Over Time */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">Messages Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.axis }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: '6px', background: chartColors.tooltip.background }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="inbound" name="Inbound" stroke="#18181B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="outbound" name="Outbound" stroke="#16A34A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* AI vs Human Pie */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">AI vs Human Messages</h3>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width={160} height={160}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: '6px', background: chartColors.tooltip.background }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: d.color }} />
                  <span className="text-xs text-zinc-600">{d.name}</span>
                  <span className="text-xs font-semibold text-zinc-900">{d.value}</span>
                </div>
              ))}
              <div className="mt-2 text-xs font-semibold text-green-700">{aiRate}% AI handled</div>
            </div>
          </div>
        </div>

        {/* New Leads vs Appointments */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 xl:col-span-2">
          <h3 className="mb-4 text-sm font-semibold text-zinc-900">Leads &amp; Appointments</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.axis }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: '6px', background: chartColors.tooltip.background }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="leads" name="New Leads" fill="#D97706" radius={[2, 2, 0, 0]} />
              <Bar dataKey="appointments" name="Appointments" fill="#2563EB" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

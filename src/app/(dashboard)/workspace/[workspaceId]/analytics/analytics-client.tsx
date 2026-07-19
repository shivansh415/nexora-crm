'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { format } from 'date-fns'
import { BarChart3 } from 'lucide-react'
import ExportCsvButton from '@/components/ui/export-csv-button'
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
      <div className="mx-auto max-w-7xl p-5 sm:p-6 lg:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl text-white shadow-md" style={{ backgroundImage: 'var(--brand-gradient)' }}>
            <BarChart3 className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Analytics</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Performance overview</p>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-zinc-200 py-20 text-center dark:border-zinc-800">
          <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-500/10">
            <BarChart3 className="size-8 text-orange-400" />
          </div>
          <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">No analytics data yet</p>
          <p className="text-xs text-zinc-400 mt-1">Analytics will populate as messages flow through the system</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl p-5 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl text-white shadow-md" style={{ backgroundImage: 'var(--brand-gradient)' }}>
            <BarChart3 className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Analytics</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Performance overview</p>
          </div>
        </div>
        <ExportCsvButton rows={chartData} filename={`analytics-${range.toLowerCase().replace(/\s+/g, '-')}`} label="Export" />
      </div>

      {/* Range Selector */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
              range === r ? 'text-white shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
            style={range === r ? { backgroundImage: 'var(--brand-gradient)' } : undefined}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 stagger xl:grid-cols-4">
        {[
          { label: 'Total Messages', value: totals.messages, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'New Leads', value: totals.leads, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Appointments Booked', value: totals.appointments, color: 'text-blue-600 dark:text-blue-400' },
          { label: 'AI Response Rate', value: `${aiRate}%`, color: 'text-emerald-600 dark:text-emerald-400' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{stat.label}</p>
            <p className={`mt-2 text-[32px] font-extrabold leading-none tabular-nums ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Messages Over Time */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-sm font-bold text-zinc-900 dark:text-zinc-100">Messages Over Time</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.axis }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: '6px', background: chartColors.tooltip.background }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="inbound" name="Inbound" stroke="#78716c" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="outbound" name="Outbound" stroke="#f97316" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* AI vs Human Pie */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="mb-4 text-sm font-bold text-zinc-900 dark:text-zinc-100">AI vs Human Messages</h3>
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
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 xl:col-span-2">
          <h3 className="mb-4 text-sm font-bold text-zinc-900 dark:text-zinc-100">Leads &amp; Appointments</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: chartColors.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: chartColors.axis }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, border: `1px solid ${chartColors.tooltip.border}`, borderRadius: '6px', background: chartColors.tooltip.background }} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="leads" name="New Leads" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="appointments" name="Appointments" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

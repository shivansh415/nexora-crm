import { format, formatDistanceToNow } from 'date-fns'
import { Download, Filter, ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { EnquiryStatus } from '@/types'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Enquiries' }

const STATUS_STYLES: Record<EnquiryStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  qualified: 'bg-green-100 text-green-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

const SOURCE_BADGES: Record<string, string> = {
  whatsapp: '📱 WhatsApp',
  google_sheets: '📊 Google Sheets',
  manual: '✏️ Manual',
}

export default async function EnquiriesPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: enquiries } = await supabase
    .from('enquiries')
    .select('id, name, phone_number, email, source, appointment_date, status, notes, conversation_id, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }) as {
      data: Array<{
        id: string; name: string; phone_number: string; email: string | null;
        source: string; appointment_date: string | null; status: EnquiryStatus;
        notes: string | null; conversation_id: string | null; created_at: string;
      }> | null; error: unknown
    }

  const safeEnquiries = enquiries ?? []
  const todayCount = safeEnquiries.filter((e) => {
    const d = new Date(e.created_at)
    const today = new Date()
    return d.toDateString() === today.toDateString()
  }).length

  // Get total count for "This Week"
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const weekCount = safeEnquiries.filter((e) => new Date(e.created_at) >= weekStart).length

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Enquiries</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Unified view of all inbound leads</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="size-3.5" /> Filter
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="mb-6 flex gap-4">
        {[
          { label: 'Today', value: todayCount },
          { label: 'This Week', value: weekCount },
          { label: 'Total', value: safeEnquiries.length },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stat.value}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              {['Name', 'Phone', 'Email', 'Source', 'Appointment', 'Status', 'Notes', 'Chat'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
            {safeEnquiries.map((enq) => (
              <tr key={enq.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900 text-xs">{enq.name}</p>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-600">{enq.phone_number}</td>
                <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">{enq.email ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="text-xs text-zinc-600">{SOURCE_BADGES[enq.source] ?? enq.source}</span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                  {enq.appointment_date
                    ? format(new Date(enq.appointment_date), 'MMM d, h:mm a')
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize', STATUS_STYLES[enq.status])}>
                    {enq.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500 max-w-[180px] truncate">
                  {enq.notes ?? '—'}
                </td>
                <td className="px-4 py-3">
                  {enq.conversation_id && (
                    <button className="text-zinc-400 hover:text-zinc-700">
                      <ExternalLink className="size-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {safeEnquiries.length === 0 && (
          <div className="py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">No enquiries yet</div>
        )}
      </div>
    </div>
  )
}

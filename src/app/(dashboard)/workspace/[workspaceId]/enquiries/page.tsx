import { format, formatDistanceToNow } from 'date-fns'
import { Download, Filter, ExternalLink, MessageSquare } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Enquiries' }

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  qualified: 'bg-green-100 text-green-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export default async function EnquiriesPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = getAdminSupabase()

  // Try enquiries table first, then fall back to leads+contacts
  const { data: enquiriesRaw } = await supabase
    .from('enquiries')
    .select('id, name, phone_number, email, source, appointment_date, status, notes, conversation_id, created_at, contact_id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }) as { data: Array<{
      id: string; name: string; phone_number: string; email: string | null;
      source: string; appointment_date: string | null; status: string;
      notes: string | null; conversation_id: string | null; created_at: string; contact_id: string | null
    }> | null; error: unknown }

  // Also pull from leads joined with contacts to show all enquiries
  const { data: leadsRaw } = await supabase
    .from('leads')
    .select('id, title, stage, notes, created_at, conversation_id, contact_id, requirements, contacts(id, name, phone_number, email, source)')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }) as { data: Array<{
      id: string; title: string; stage: string; notes: string | null;
      created_at: string; conversation_id: string | null; contact_id: string;
      requirements: string | null;
      contacts: { id: string; name: string; phone_number: string; email: string | null; source: string } | null;
    }> | null; error: unknown }

  const safeEnquiries = enquiriesRaw ?? []
  const safeLeads = leadsRaw ?? []

  const todayStr = new Date().toDateString()
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())

  // Merge: use enquiries table if populated, else build from leads
  const showFromLeads = safeEnquiries.length === 0 && safeLeads.length > 0

  const todayCount = showFromLeads
    ? safeLeads.filter(l => new Date(l.created_at).toDateString() === todayStr).length
    : safeEnquiries.filter(e => new Date(e.created_at).toDateString() === todayStr).length

  const weekCount = showFromLeads
    ? safeLeads.filter(l => new Date(l.created_at) >= weekStart).length
    : safeEnquiries.filter(e => new Date(e.created_at) >= weekStart).length

  const total = showFromLeads ? safeLeads.length : safeEnquiries.length

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Enquiries</h1>
          <p className="text-xs text-zinc-500 mt-0.5">All inbound leads and enquiries from WhatsApp</p>
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
          { label: 'Total', value: total },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-800 px-4 py-2.5">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{stat.value}</span>
            <span className="text-xs text-zinc-500">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {showFromLeads ? (
          // Show from leads table
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  {['Name', 'Phone', 'Requirements', 'Stage', 'Source', 'Received', 'Chat'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {safeLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">{lead.contacts?.name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{lead.contacts?.phone_number ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500 max-w-[200px] truncate">{lead.requirements ?? lead.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize', STATUS_STYLES[lead.stage] ?? 'bg-zinc-100 text-zinc-500')}>
                        {lead.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">📱 WhatsApp</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      {lead.conversation_id && (
                        <Link href={`/workspace/${workspaceId}/chats/${lead.conversation_id}`} className="text-zinc-400 hover:text-zinc-700">
                          <MessageSquare className="size-3.5" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {safeLeads.length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-400">No enquiries yet</div>
            )}
          </>
        ) : (
          // Show from enquiries table
          <>
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
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">{enq.name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{enq.phone_number}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{enq.email ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600">📱 WhatsApp</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">
                      {enq.appointment_date ? format(new Date(enq.appointment_date), 'MMM d, h:mm a') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-semibold capitalize', STATUS_STYLES[enq.status] ?? 'bg-zinc-100 text-zinc-500')}>
                        {enq.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500 max-w-[180px] truncate">{enq.notes ?? '—'}</td>
                    <td className="px-4 py-3">
                      {enq.conversation_id && (
                        <Link href={`/workspace/${workspaceId}/chats/${enq.conversation_id}`} className="text-zinc-400 hover:text-zinc-700">
                          <ExternalLink className="size-3.5" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {safeEnquiries.length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-400">No enquiries yet</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

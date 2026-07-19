import { format, formatDistanceToNow } from 'date-fns'
import { ExternalLink, MessageSquare, MessageCircle, Inbox } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import ExportCsvButton from '@/components/ui/export-csv-button'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Enquiries' }

const STATUS_STYLES: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
  contacted: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  qualified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
  closed: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
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

  // Flatten for CSV export
  const exportRows = showFromLeads
    ? safeLeads.map((l) => ({
        Name: l.contacts?.name ?? '',
        Phone: l.contacts?.phone_number ?? '',
        Email: l.contacts?.email ?? '',
        Requirements: l.requirements ?? l.notes ?? '',
        Stage: l.stage,
        Source: 'WhatsApp',
        Received: new Date(l.created_at).toLocaleString('en-IN'),
      }))
    : safeEnquiries.map((e) => ({
        Name: e.name ?? '',
        Phone: e.phone_number ?? '',
        Email: e.email ?? '',
        Requirements: e.notes ?? '',
        Stage: e.status,
        Source: e.source ?? '',
        Received: new Date(e.created_at).toLocaleString('en-IN'),
      }))

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl text-white shadow-md" style={{ backgroundImage: 'var(--brand-gradient)' }}>
            <Inbox className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Enquiries</h1>
            <p className="text-xs text-zinc-500 mt-0.5">All inbound leads and enquiries from WhatsApp</p>
          </div>
        </div>
        <ExportCsvButton rows={exportRows} filename="enquiries" />
      </div>

      {/* Quick Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        {[
          { label: 'Today', value: todayCount, accent: true },
          { label: 'This Week', value: weekCount, accent: false },
          { label: 'Total', value: total, accent: false },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className={cn('block text-2xl font-extrabold tabular-nums', stat.accent ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-900 dark:text-zinc-100')}>{stat.value}</span>
            <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
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
                  <tr key={lead.id} className="transition-colors hover:bg-orange-50/40 dark:hover:bg-zinc-800/60">
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
                    <td className="px-4 py-3 text-xs text-zinc-500"><span className="inline-flex items-center gap-1.5"><MessageCircle className="size-3.5 text-emerald-500" /> WhatsApp</span></td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      {lead.conversation_id && (
                        <Link href={`/workspace/${workspaceId}/chats/${lead.conversation_id}`} className="inline-flex text-zinc-400 transition-colors hover:text-orange-600">
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
                  <tr key={enq.id} className="transition-colors hover:bg-orange-50/40 dark:hover:bg-zinc-800/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">{enq.name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{enq.phone_number}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{enq.email ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-zinc-600"><span className="inline-flex items-center gap-1.5"><MessageCircle className="size-3.5 text-emerald-500" /> WhatsApp</span></td>
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
                        <Link href={`/workspace/${workspaceId}/chats/${enq.conversation_id}`} className="inline-flex text-zinc-400 transition-colors hover:text-orange-600">
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

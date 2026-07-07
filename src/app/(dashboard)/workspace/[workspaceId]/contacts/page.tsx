import { format, formatDistanceToNow } from 'date-fns'
import { Search, Plus, Upload, Star, Users } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PageProps {
  params: Promise<{ workspaceId: string }>
}

export const metadata = { title: 'Contacts' }

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarColor(name: string): string {
  const colors = ['bg-blue-500','bg-purple-500','bg-green-500','bg-amber-500','bg-pink-500','bg-indigo-500']
  return colors[name.charCodeAt(0) % colors.length]
}

function LeadScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full', score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-amber-400' : 'bg-zinc-300')}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{score}</span>
    </div>
  )
}

export default async function ContactsPage({ params }: PageProps) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, phone_number, email, tags, lead_score, source, last_seen_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false }) as {
      data: Array<{
        id: string; name: string; phone_number: string; email: string | null;
        tags: string[]; lead_score: number; source: string; last_seen_at: string | null;
      }> | null; error: unknown
    }

  const safeContacts = contacts ?? []

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Contacts</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{safeContacts.length} total contacts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Upload className="size-3.5" /> Import CSV
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" /> New Contact
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 dark:text-zinc-500" />
        <Input placeholder="Search by name, phone, email..." className="pl-9" />
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {safeContacts.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="size-10 text-zinc-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No contacts yet</p>
            <p className="text-xs text-zinc-400 mt-1">Contacts will be created when customers message you on WhatsApp</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                {['Contact', 'Phone', 'Tags', 'Lead Score', 'Source', 'Last Seen', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {safeContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className={cn('text-xs font-semibold text-white', getAvatarColor(contact.name))}>
                          {getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-zinc-900 text-xs">{contact.name}</p>
                        {contact.email && <p className="text-zinc-400 text-[10px]">{contact.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600">{contact.phone_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(contact.tags ?? []).slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-medium text-zinc-600">{tag}</span>
                      ))}
                      {(contact.tags ?? []).length > 2 && (
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-500">+{contact.tags.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <LeadScoreBar score={contact.lead_score} />
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 capitalize">{contact.source.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {contact.last_seen_at ? formatDistanceToNow(new Date(contact.last_seen_at), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="rounded px-2 py-1 text-[10px] bg-zinc-100 hover:bg-zinc-200 text-zinc-600">View</button>
                      <button className="rounded px-2 py-1 text-[10px] bg-zinc-100 hover:bg-zinc-200 text-zinc-600">Chat</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

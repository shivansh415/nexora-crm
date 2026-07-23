'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Search, Plus, Upload, Users, MessageSquare, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

export interface ContactRow {
  id: string
  name: string
  phone_number: string
  email: string | null
  tags: string[]
  lead_score: number
  source: string
  last_seen_at: string | null
  conversation_id: string | null
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}
function getAvatarColor(name: string): string {
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500', 'bg-pink-500', 'bg-indigo-500']
  return colors[name.charCodeAt(0) % colors.length]
}

function LeadScoreBar({ score }: { score: number }) {
  const isHot = score >= 80, isWarm = score >= 50 && score < 80, isCool = score >= 30 && score < 50
  const label = isHot ? 'Hot' : isWarm ? 'Warm' : isCool ? 'Cool' : 'Cold'
  const cls = isHot ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' : isWarm ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' : isCool ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
  const dot = isHot ? 'bg-red-500' : isWarm ? 'bg-amber-400' : isCool ? 'bg-blue-400' : 'bg-zinc-300'
  return (
    <div className="flex items-center gap-2">
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold', cls)}>
        <span className={cn('size-1.5 rounded-full', dot)} />{label}
      </span>
      <div className="flex items-center gap-1">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className={cn('h-full rounded-full', dot)} style={{ width: `${score}%` }} />
        </div>
        <span className="text-[10px] font-semibold tabular-nums text-zinc-400">{score}</span>
      </div>
    </div>
  )
}

export default function ContactsClient({ initial, workspaceId }: { initial: ContactRow[]; workspaceId: string }) {
  const router = useRouter()
  const [contacts, setContacts] = useState<ContactRow[]>(initial)
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<ContactRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const q = search.trim().toLowerCase()
  const filtered = !q ? contacts : contacts.filter((c) =>
    c.name.toLowerCase().includes(q) ||
    c.phone_number.includes(q) ||
    (c.email ?? '').toLowerCase().includes(q)
  )

  function openChat(c: ContactRow) {
    if (c.conversation_id) router.push(`/workspace/${workspaceId}/chats/${c.conversation_id}`)
    else router.push(`/workspace/${workspaceId}/chats`)
  }

  async function handleAdd() {
    if (!newPhone.trim() || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/contacts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim(), email: newEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add contact')
        return
      }
      setContacts((prev) => [{ ...data.contact, conversation_id: null }, ...prev])
      toast.success('Contact added')
      setAddOpen(false); setNewName(''); setNewPhone(''); setNewEmail('')
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl text-white shadow-md" style={{ backgroundImage: 'var(--brand-gradient)' }}>
            <Users className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">Contacts</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              <span className="font-semibold text-orange-600 dark:text-orange-400">{contacts.length}</span> total contacts
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/workspace/${workspaceId}/broadcast`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Upload className="size-3.5" /> Import CSV
            </Button>
          </Link>
          <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> New Contact
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 dark:text-zinc-500" />
        <Input
          placeholder="Search by name, phone, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-500/10">
              <Users className="size-7 text-orange-400" />
            </div>
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              {contacts.length === 0 ? 'No contacts yet' : 'No contacts match your search'}
            </p>
            <p className="text-xs text-zinc-400 mt-1">Contacts are created when customers message you on WhatsApp</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                {['Contact', 'Phone', 'Tags', 'Lead Score', 'Source', 'Last Seen', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
              {filtered.map((contact) => (
                <tr key={contact.id} className="group transition-colors hover:bg-orange-50/40 dark:hover:bg-zinc-800/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className={cn('text-xs font-semibold text-white', getAvatarColor(contact.name))}>
                          {getInitials(contact.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">{contact.name}</p>
                        {contact.email && <p className="text-zinc-400 text-[10px]">{contact.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">{contact.phone_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(contact.tags ?? []).slice(0, 2).map((tag) => (
                        <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-medium text-zinc-600">{tag}</span>
                      ))}
                      {(contact.tags ?? []).length > 2 && (
                        <span className="text-[9px] text-zinc-400">+{contact.tags.length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3"><LeadScoreBar score={contact.lead_score} /></td>
                  <td className="px-4 py-3 text-xs text-zinc-500 capitalize">{contact.source.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {contact.last_seen_at ? formatDistanceToNow(new Date(contact.last_seen_at), { addSuffix: true }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => setViewing(contact)} className="rounded-lg bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">View</button>
                      <button onClick={() => openChat(contact)} className="rounded-lg bg-orange-100 px-2.5 py-1 text-[10px] font-semibold text-orange-700 transition-colors hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-400">Chat</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* View contact */}
      <Dialog open={!!viewing} onOpenChange={(o) => { if (!o) setViewing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>{viewing?.phone_number}</DialogDescription>
          </DialogHeader>
          {viewing && (
            <>
              <DialogBody className="space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-zinc-500 dark:text-zinc-400">Email</span><span className="font-medium">{viewing.email ?? '—'}</span></div>
                <div className="flex items-center justify-between"><span className="text-zinc-500 dark:text-zinc-400">Source</span><span className="font-medium capitalize">{viewing.source.replace('_', ' ')}</span></div>
                <div className="flex items-center justify-between"><span className="text-zinc-500 dark:text-zinc-400">Lead score</span><LeadScoreBar score={viewing.lead_score} /></div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-zinc-500 shrink-0 dark:text-zinc-400">Tags</span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {(viewing.tags ?? []).map((t) => <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{t}</span>)}
                  </div>
                </div>
              </DialogBody>
              <DialogFooter>
                <Button size="sm" className="gap-1.5" onClick={() => openChat(viewing)}>
                  <MessageSquare className="size-3.5" /> Open Chat
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New contact */}
      <Dialog open={addOpen} onOpenChange={(o) => { if (!o) setAddOpen(false) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New contact</DialogTitle>
            <DialogDescription>Add a contact to the CRM. This does not message them.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Name <span className="text-zinc-400 font-normal">(optional)</span></Label>
              <Input id="c-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Rahul Sharma" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone number</Label>
              <Input id="c-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} inputMode="tel" placeholder="+92 300 1234567 (any country)" onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email <span className="text-zinc-400 font-normal">(optional)</span></Label>
              <Input id="c-email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="rahul@example.com" />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleAdd} disabled={!newPhone.trim() || saving} className="gap-1.5">
              {saving ? <><RefreshCw className="size-4 animate-spin" /> Adding…</> : 'Add contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

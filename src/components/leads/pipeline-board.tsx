'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import {
  Plus,
  LayoutGrid,
  List,
  Tag,
  Calendar,
  DollarSign,
  User,
  Phone,
  Search,
  GripVertical,
  ExternalLink,
  ChevronRight,
  Inbox,
  Bot,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Lead, LeadStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const STAGES: { id: LeadStatus; label: string; color: string; border: string }[] = [
  { id: 'new', label: 'New', color: 'bg-zinc-400', border: 'border-zinc-300' },
  { id: 'contacted', label: 'Contacted', color: 'bg-blue-500', border: 'border-blue-200' },
  { id: 'qualified', label: 'Qualified', color: 'bg-amber-500', border: 'border-amber-200' },
  { id: 'won', label: 'Won', color: 'bg-green-500', border: 'border-green-200' },
]

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatCurrency(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  return `₹${value.toLocaleString()}`
}

function getSourceIcon(source: string) {
  if (source === 'whatsapp') return '📱'
  if (source === 'google_sheets') return '📊'
  return '✏️'
}

interface PipelineBoardProps {
  workspaceId: string
  leads: Lead[]
}

export default function PipelineBoard({ workspaceId, leads: initialLeads }: PipelineBoardProps) {
  const [leads, setLeads] = useState(initialLeads)
  const [view, setView] = useState<'board' | 'table'>('board')
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<LeadStatus | null>(null)

  const filteredLeads = leads.filter(
    (l) =>
      !search ||
      l.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.contact?.phone_number?.includes(search) ||
      l.title.toLowerCase().includes(search.toLowerCase())
  )

  const lostLeads = filteredLeads.filter((l) => l.status === 'lost')

  function handleDragStart(leadId: string) {
    setDragging(leadId)
  }

  function handleDragOver(e: React.DragEvent, stage: LeadStatus) {
    e.preventDefault()
    setDragOver(stage)
  }

  async function handleDrop(stage: LeadStatus) {
    if (!dragging) return
    const leadId = dragging
    const prevStatus = leads.find((l) => l.id === leadId)?.status
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: stage, pipeline_stage: stage } : l))
    )
    setDragging(null)
    setDragOver(null)

    try {
      const res = await fetch('/api/leads/update-stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, stage }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Failed to update stage')
        // Revert
        if (prevStatus) {
          setLeads((prev) =>
            prev.map((l) => (l.id === leadId ? { ...l, status: prevStatus, pipeline_stage: prevStatus } : l))
          )
        }
        return
      }
      toast.success(`Moved to ${stage}`)
    } catch {
      toast.error('Network error — reverted')
      if (prevStatus) {
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: prevStatus, pipeline_stage: prevStatus } : l))
        )
      }
    }
  }

  function updateLeadNote(leadId: string, notes: string) {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, notes } : l)))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Lead Pipeline</h1>
          <p className="text-xs text-zinc-500 mt-0.5">{leads.filter((l) => !['won', 'lost'].includes(l.status)).length} active leads</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400 dark:text-zinc-500" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-48 text-sm"
            />
          </div>
          <div className="flex rounded-md border border-zinc-200 overflow-hidden">
            <button
              onClick={() => setView('board')}
              className={cn('px-2.5 py-1.5 transition-colors', view === 'board' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50')}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              onClick={() => setView('table')}
              className={cn('px-2.5 py-1.5 transition-colors', view === 'table' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50')}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {view === 'board' ? (
        // ─── Board View ────────────────────────────────────────────
        <div className="flex-1 overflow-x-auto">
          <div className="flex h-full gap-3 p-4 min-w-max">
            {STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.status === stage.id)
              const totalValue = stageLeads.reduce((sum, l) => sum + (l.value ?? 0), 0)
              return (
                <div
                  key={stage.id}
                  className={cn(
                    'flex w-72 flex-col rounded-lg border transition-colors',
                    dragOver === stage.id ? 'border-zinc-400 bg-zinc-100' : 'border-zinc-200 bg-zinc-50/50'
                  )}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDrop={() => handleDrop(stage.id)}
                  onDragLeave={() => setDragOver(null)}
                >
                  {/* Column Header */}
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                    <span className={cn('size-2 rounded-full', stage.color)} />
                    <span className="text-xs font-semibold text-zinc-700">{stage.label}</span>
                    <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-600">
                      {stageLeads.length}
                    </span>
                  </div>
                  {totalValue > 0 && (
                    <div className="px-3 py-1 text-[10px] text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/60">
                      {formatCurrency(totalValue)} total pipeline
                    </div>
                  )}

                  {/* Cards */}
                  <ScrollArea className="flex-1 p-2">
                    <div className="space-y-2">
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => handleDragStart(lead.id)}
                          onClick={() => setSelectedLead(lead)}
                          className={cn(
                            'group cursor-pointer rounded-lg border border-zinc-200 bg-white p-3 shadow-sm transition-all hover:shadow-md hover:border-zinc-300',
                            dragging === lead.id && 'opacity-50'
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs">{getSourceIcon(lead.source)}</span>
                              <p className="text-xs font-semibold text-zinc-900 line-clamp-1">
                                {lead.contact?.name ?? 'Unknown'}
                              </p>
                            </div>
                            <GripVertical className="size-3 text-zinc-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <p className="text-[11px] text-zinc-500 mb-2 line-clamp-1">{lead.title}</p>
                          {lead.contact?.phone_number && (
                            <p className="text-[10px] text-zinc-400 mb-2">{lead.contact.phone_number}</p>
                          )}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {lead.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-medium text-zinc-600">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
                            {lead.value && (
                              <span className="flex items-center gap-0.5 font-medium text-zinc-600">
                                {formatCurrency(lead.value)}
                              </span>
                            )}
                            {lead.expected_close_date && (
                              <span className="flex items-center gap-0.5">
                                <Calendar className="size-2.5" />
                                {format(new Date(lead.expected_close_date), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {stageLeads.length === 0 && (
                        <div className="rounded-lg border border-dashed border-zinc-200 px-3 py-6 text-center">
                          <p className="text-xs text-zinc-400 dark:text-zinc-500">No leads here</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )
            })}

            {/* Lost column */}
            {lostLeads.length > 0 && (
              <div className="flex w-72 flex-col rounded-lg border border-red-100 bg-red-50/30">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-red-100">
                  <span className="size-2 rounded-full bg-red-400" />
                  <span className="text-xs font-semibold text-zinc-600">Lost</span>
                  <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-red-100 text-[10px] font-bold text-red-500">
                    {lostLeads.length}
                  </span>
                </div>
                <ScrollArea className="flex-1 p-2">
                  <div className="space-y-2">
                    {lostLeads.map((lead) => (
                      <div
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        className="cursor-pointer rounded-lg border border-red-100 bg-white/60 p-3 opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <p className="text-xs font-medium text-zinc-600">{lead.contact?.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{lead.title}</p>
                        {lead.lost_reason && (
                          <p className="text-[10px] text-red-500 mt-1">Reason: {lead.lost_reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ─── Table View ─────────────────────────────────────────────
        <div className="flex-1 overflow-auto p-4">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  {['Contact', 'Title', 'Status', 'Value', 'Source', 'Close Date', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800">
                {filteredLeads.map((lead) => {
                  const stage = STAGES.find((s) => s.id === lead.status)
                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-zinc-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarFallback className="bg-zinc-200 text-xs text-zinc-700">
                              {getInitials(lead.contact?.name ?? 'U')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-zinc-900 text-xs">{lead.contact?.name}</p>
                            <p className="text-zinc-400 text-[10px]">{lead.contact?.phone_number}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-700">{lead.title}</td>
                      <td className="px-4 py-3">
                        {stage && (
                          <span className={cn('flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            lead.status === 'won' ? 'bg-green-100 text-green-700' :
                            lead.status === 'lost' ? 'bg-red-100 text-red-600' :
                            lead.status === 'qualified' ? 'bg-amber-100 text-amber-700' :
                            lead.status === 'proposal' ? 'bg-purple-100 text-purple-700' :
                            lead.status === 'contacted' ? 'bg-blue-100 text-blue-700' :
                            'bg-zinc-100 text-zinc-600'
                          )}>
                            {stage.label}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-zinc-700">
                        {lead.value ? formatCurrency(lead.value) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500 capitalize">{lead.source.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                        {lead.expected_close_date
                          ? format(new Date(lead.expected_close_date), 'MMM d, yyyy')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-zinc-400 hover:text-zinc-700">
                          <ChevronRight className="size-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead Detail Drawer */}
      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          {selectedLead && (
            <>
              <SheetHeader className="border-b border-zinc-200 px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-base">{selectedLead.contact?.name ?? 'Lead Detail'}</SheetTitle>
                    <p className="text-sm text-zinc-500 mt-0.5">{selectedLead.title}</p>
                  </div>
                  {selectedLead.value && (
                    <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(selectedLead.value)}</span>
                  )}
                </div>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-80px)]">
                <div className="px-6 py-4 space-y-6">
                  {/* Status Row */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Status</label>
                      <p className="mt-1 text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">
                        {selectedLead.status.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Source</label>
                      <p className="mt-1 text-sm text-zinc-700 capitalize">
                        {getSourceIcon(selectedLead.source)} {selectedLead.source.replace('_', ' ')}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Contact</label>
                      <p className="mt-1 text-sm text-zinc-700">{selectedLead.contact?.phone_number}</p>
                    </div>
                    {selectedLead.expected_close_date && (
                      <div>
                        <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Close Date</label>
                        <p className="mt-1 text-sm text-zinc-700">
                          {format(new Date(selectedLead.expected_close_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {selectedLead.tags.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2 block">Tags</label>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedLead.tags.map((tag) => (
                          <span key={tag} className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                            {tag}
                          </span>
                        ))}
                        <button className="rounded-full border border-dashed border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-400 hover:border-zinc-400 transition-colors">
                          + Add
                        </button>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Qualification Data */}
                  {Object.keys(selectedLead.qualification_data as object).length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2 block">Qualification Data</label>
                      <div className="rounded-lg border border-zinc-100 bg-zinc-50 divide-y divide-zinc-100">
                        {Object.entries(selectedLead.qualification_data as Record<string, string>).map(([k, v]) => (
                          <div key={k} className="flex justify-between px-3 py-2 text-xs">
                            <span className="font-medium text-zinc-500 capitalize">{k.replace('_', ' ')}</span>
                            <span className="text-zinc-900">{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2 block">Notes</label>
                    <Textarea
                      value={selectedLead.notes ?? ''}
                      onChange={(e) => {
                        updateLeadNote(selectedLead.id, e.target.value)
                        setSelectedLead((prev) => prev ? { ...prev, notes: e.target.value } : null)
                      }}
                      placeholder="Add a note..."
                      className="text-sm min-h-24 resize-none"
                    />
                    <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">Auto-saved</p>
                  </div>

                  {/* Activity Timeline */}
                  <div>
                    <label className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3 block">Activity Timeline</label>
                    <div className="space-y-3">
                      {[
                        { icon: '🤖', text: 'AI qualified lead — budget and location collected', time: '2 days ago' },
                        { icon: '📝', text: 'Status changed: New → Qualified', time: '5 days ago' },
                        { icon: '💬', text: 'Lead created from WhatsApp conversation', time: '7 days ago' },
                      ].map((act, i) => (
                        <div key={i} className="flex gap-3 text-xs">
                          <span className="shrink-0 mt-0.5">{act.icon}</span>
                          <div>
                            <p className="text-zinc-700">{act.text}</p>
                            <p className="text-zinc-400 mt-0.5">{act.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {selectedLead.conversation_id ? (
                      <a
                        href={`/workspace/${workspaceId}/chats/${selectedLead.conversation_id}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                      >
                        <ExternalLink className="size-3.5" /> Open Chat
                      </a>
                    ) : (
                      <a
                        href={`/workspace/${workspaceId}/chats`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-accent transition-colors"
                      >
                        <ExternalLink className="size-3.5" /> Go to Chats
                      </a>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import {
  Search,
  Filter,
  Pin,
  Bot,
  UserRound,
  CheckCheck,
  Check,
  Send,
  ArrowLeft,
  MoreVertical,
  Phone,
  Info,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Conversation, Message } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'

type ConvFilter = 'all' | 'open' | 'human_takeover' | 'ai_active'

const FILTERS: { id: ConvFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'human_takeover', label: 'Takeover' },
  { id: 'ai_active', label: 'AI Active' },
]

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-amber-500',
    'bg-pink-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500',
  ]
  const idx = name.charCodeAt(0) % colors.length
  return colors[idx]
}

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr)
  if (isToday(d)) return format(d, 'h:mm a')
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d')
}

function getDateSeparator(dateStr: string): string {
  const d = new Date(dateStr)
  if (isToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMMM d, yyyy')
}

function MessageStatus({ status }: { status: string }) {
  if (status === 'read') return <CheckCheck className="size-3 text-blue-400" />
  if (status === 'delivered') return <CheckCheck className="size-3 text-zinc-400" />
  if (status === 'sent') return <Check className="size-3 text-zinc-400" />
  return null
}

interface ChatViewProps {
  workspaceId: string
  initialConversationId?: string
}

export default function ChatView({ workspaceId, initialConversationId }: ChatViewProps) {
  const supabase = getSupabaseClient()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ConvFilter>('all')
  const [selectedConvId, setSelectedConvId] = useState<string | null>(initialConversationId ?? null)
  const [messageText, setMessageText] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [showMobileChat, setShowMobileChat] = useState(!!initialConversationId)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── Fetch conversations from Supabase ──────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        contacts (
          id, name, phone_number, email, avatar_url, tags, lead_score
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(100)

    if (error) {
      console.error('[chat] fetch conversations error:', error)
      toast.error('Failed to load conversations')
      return
    }

    // Map Supabase schema → app Conversation type
    const mapped: Conversation[] = (data ?? []).map((row: any) => ({
      id: row.id,
      workspace_id: row.workspace_id,
      contact_id: row.contact_id,
      status: row.status === 'active' ? 'open' : row.status,
      assigned_agent_id: row.assigned_to ?? null,
      is_pinned: false,
      is_archived: row.status === 'archived',
      unread_count: row.unread_count ?? 0,
      last_message_at: row.last_message_at ?? null,
      last_message_preview: row.last_message_preview ?? null,
      ai_mode: row.ai_paused ? 'paused' : 'enabled',
      label: null,
      metadata: row.metadata ?? {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      contact: row.contacts ? {
        id: row.contacts.id,
        workspace_id: workspaceId,
        whatsapp_id: row.contacts.phone_number,
        phone_number: row.contacts.phone_number,
        name: row.contacts.name,
        email: row.contacts.email ?? null,
        avatar_url: row.contacts.avatar_url ?? null,
        tags: row.contacts.tags ?? [],
        notes: null,
        lead_score: row.contacts.lead_score ?? 0,
        source: 'whatsapp' as const,
        custom_fields: {},
        is_blocked: false,
        last_seen_at: null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      } : undefined,
    }))

    setConversations(mapped)
    setLoading(false)
  }, [workspaceId, supabase])

  // ── Fetch messages for selected conversation ───────────────────────────────
  const fetchMessages = useCallback(async (convId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) {
      console.error('[chat] fetch messages error:', error)
      return
    }

    const mapped: Message[] = (data ?? []).map((row: any) => ({
      id: row.id,
      workspace_id: row.workspace_id,
      conversation_id: row.conversation_id,
      contact_id: '',
      direction: row.direction,
      sender_type: row.sender_type === 'contact' ? 'customer' : row.sender_type,
      sender_id: row.sender_id ?? null,
      content: row.content ?? '',
      content_type: row.message_type ?? 'text',
      media_url: row.media_url ?? null,
      whatsapp_message_id: row.wa_message_id ?? null,
      status: row.status ?? 'sent',
      is_deleted: false,
      metadata: row.metadata ?? {},
      sent_at: row.timestamp ?? row.created_at,
      created_at: row.created_at,
    }))

    setMessages(mapped)
  }, [supabase])

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // ── Load messages when conversation selected ───────────────────────────────
  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId)
    } else {
      setMessages([])
    }
  }, [selectedConvId, fetchMessages])

  // ── Scroll to bottom on new messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Supabase Realtime — conversations ─────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`conversations:workspace:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          // Re-fetch on any conversation change
          fetchConversations()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [workspaceId, supabase, fetchConversations])

  // ── Supabase Realtime — messages ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedConvId) return

    const channel = supabase
      .channel(`messages:conv:${selectedConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          const row = payload.new as any
          const newMsg: Message = {
            id: row.id,
            workspace_id: row.workspace_id,
            conversation_id: row.conversation_id,
            contact_id: '',
            direction: row.direction,
            sender_type: row.sender_type === 'contact' ? 'customer' : row.sender_type,
            sender_id: row.sender_id ?? null,
            content: row.content ?? '',
            content_type: row.message_type ?? 'text',
            media_url: row.media_url ?? null,
            whatsapp_message_id: row.wa_message_id ?? null,
            status: row.status ?? 'sent',
            is_deleted: false,
            metadata: row.metadata ?? {},
            sent_at: row.created_at,
            created_at: row.created_at,
          }
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev
            // Sort by created_at to maintain correct order
            return [...prev, newMsg].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedConvId, supabase])

  // ── Filter & sort ──────────────────────────────────────────────────────────
  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      !search ||
      conv.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
      conv.contact?.phone_number?.includes(search) ||
      conv.last_message_preview?.toLowerCase().includes(search.toLowerCase())

    if (!matchesSearch) return false
    if (filter === 'all') return true
    if (filter === 'open') return conv.status === 'open'
    if (filter === 'human_takeover') return conv.status === 'human_takeover'
    if (filter === 'ai_active') return conv.ai_mode === 'enabled'
    return true
  })

  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime()
  })

  const selectedConv = conversations.find((c) => c.id === selectedConvId)

  function selectConversation(conv: Conversation) {
    setSelectedConvId(conv.id)
    setShowMobileChat(true)
    // Mark as read
    if (conv.unread_count > 0) {
      fetch('/api/conversations/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: conv.id }),
      }).then(() => {
        setConversations((prev) =>
          prev.map((c) => c.id === conv.id ? { ...c, unread_count: 0 } : c)
        )
      })
    }
  }

  // ── Send message via API route ────────────────────────────────────────────
  async function handleSend() {
    if (!messageText.trim() || !selectedConvId || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConvId,
          workspaceId,
          message: messageText.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to send message')
        return
      }
      setMessageText('')
      // Realtime will append the message — no need to manually push
    } catch {
      toast.error('Network error — could not send message')
    } finally {
      setSending(false)
    }
  }

  // ── AI toggle ─────────────────────────────────────────────────────────────
  async function handleTakeover() {
    if (!selectedConvId) return
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConvId
          ? { ...c, status: 'human_takeover', ai_mode: 'paused', assigned_agent_id: 'me' }
          : c
      )
    )
    try {
      const res = await fetch('/api/conversations/toggle-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConvId, paused: true }),
      })
      if (!res.ok) {
        toast.error('Failed to pause AI')
        await fetchConversations() // revert on failure
        return
      }
      toast.success('AI paused — you are now in control')
    } catch {
      toast.error('Network error')
      await fetchConversations()
    }
  }

  async function handleResumeAI() {
    if (!selectedConvId) return
    // Optimistic update
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConvId
          ? { ...c, status: 'open', ai_mode: 'enabled', assigned_agent_id: null }
          : c
      )
    )
    try {
      const res = await fetch('/api/conversations/toggle-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selectedConvId, paused: false }),
      })
      if (!res.ok) {
        toast.error('Failed to resume AI')
        await fetchConversations()
        return
      }
      toast.success('AI resumed — AI will handle next message')
    } catch {
      toast.error('Network error')
      await fetchConversations()
    }
  }

  // ── Group messages with date separators ───────────────────────────────────
  type MsgGroup = { type: 'separator'; date: string } | { type: 'message'; message: Message }
  const groupedItems: MsgGroup[] = []
  let lastDate = ''
  for (const msg of messages) {
    const msgDate = getDateSeparator(msg.sent_at)
    if (msgDate !== lastDate) {
      groupedItems.push({ type: 'separator', date: msgDate })
      lastDate = msgDate
    }
    groupedItems.push({ type: 'message', message: msg })
  }

  const currentConv = conversations.find((c) => c.id === selectedConvId)

  // ─── Conversation List Panel ──────────────────────────────────────────────
  const ConversationListPanel = (
    <div className={cn(
      'flex flex-col border-r border-zinc-200 bg-white',
      showMobileChat ? 'hidden md:flex' : 'flex',
      'w-full md:w-[320px] md:min-w-[320px]'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h1 className="text-base font-bold text-zinc-900">Chats</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={fetchConversations} title="Refresh">
            <RefreshCw className="size-4 text-zinc-500" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7">
            <Filter className="size-4 text-zinc-500" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-zinc-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm" style={{ backgroundColor: "var(--wa-bg)", borderColor: "var(--wa-border)" }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto px-3 py-2 border-b border-zinc-100 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f.id
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <RefreshCw className="size-6 text-zinc-300 animate-spin mb-3" />
            <p className="text-sm text-zinc-400">Loading chats...</p>
          </div>
        ) : sortedConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <MessageSquareIcon className="size-10 text-zinc-200 mb-3" />
            <p className="text-sm font-medium text-zinc-500">No conversations yet</p>
            <p className="text-xs text-zinc-400 mt-1">Messages from WhatsApp will appear here in real-time</p>
          </div>
        ) : (
          sortedConversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 text-left border-b border-zinc-50 transition-colors',
                selectedConvId === conv.id ? '!bg-[var(--wa-surface-2)]' : '',
                conv.status === 'human_takeover' && 'border-l-2 border-l-blue-500'
              )}
            >
              <div className="relative shrink-0">
                <Avatar className="size-10">
                  <AvatarFallback className={cn('text-xs font-semibold text-white', getAvatarColor(conv.contact?.name ?? 'U'))}>
                    {getInitials(conv.contact?.name ?? 'Unknown')}
                  </AvatarFallback>
                </Avatar>
                {conv.is_pinned && (
                  <Pin className="absolute -top-1 -right-1 size-3 text-zinc-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className={cn('truncate text-sm', conv.unread_count > 0 ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700')}>
                    {conv.contact?.name ?? conv.contact?.phone_number ?? 'Unknown'}
                  </p>
                  <span className="shrink-0 text-[10px] text-zinc-400">
                    {conv.last_message_at ? formatMsgTime(conv.last_message_at) : ''}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <p className="flex-1 truncate text-xs text-zinc-500">
                    {conv.last_message_preview}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    {conv.ai_mode === 'enabled' && (
                      <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-700">AI</span>
                    )}
                    {conv.status === 'human_takeover' && (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-semibold text-blue-700">Agent</span>
                    )}
                    {conv.unread_count > 0 && (
                      <span className="flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: "var(--wa-green)" }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  )

  // ─── Chat Window Panel ────────────────────────────────────────────────────
  const ChatWindowPanel = (
    <div className={cn(
      'flex flex-1 flex-col',
      !showMobileChat && 'hidden md:flex',
      !selectedConvId && 'md:items-center md:justify-center'
    )}
    style={{ backgroundColor: selectedConvId ? 'var(--wa-surface)' : 'var(--wa-bg)' }}
    >
      {!selectedConvId ? (
        <div className="text-center">
          <div className="text-5xl mb-4">💬</div>
          <p className="text-sm font-medium text-zinc-600">Select a conversation</p>
          <p className="text-xs text-zinc-400 mt-1">Choose from the list to start chatting</p>
        </div>
      ) : (
        <>
          {/* Chat Header */}
          <div className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3">
            <button
              onClick={() => { setShowMobileChat(false); setSelectedConvId(null) }}
              className="md:hidden shrink-0"
            >
              <ArrowLeft className="size-5 text-zinc-500" />
            </button>
            <Avatar className="size-9 shrink-0">
              <AvatarFallback className={cn('text-xs font-semibold text-white', getAvatarColor(currentConv?.contact?.name ?? 'U'))}>
                {getInitials(currentConv?.contact?.name ?? 'Unknown')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 truncate">
                {currentConv?.contact?.name ?? currentConv?.contact?.phone_number ?? 'Unknown'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{currentConv?.contact?.phone_number}</span>
                <Separator orientation="vertical" className="h-3" />
                {currentConv?.ai_mode === 'enabled' && (
                  <span className="flex items-center gap-1 text-xs text-green-600">
                    <span className="size-1.5 rounded-full bg-green-500" />AI Active
                  </span>
                )}
                {currentConv?.status === 'human_takeover' && (
                  <span className="flex items-center gap-1 text-xs text-blue-600">
                    <span className="size-1.5 rounded-full bg-blue-500" />Human Mode
                  </span>
                )}
                {currentConv?.ai_mode === 'paused' && currentConv?.status !== 'human_takeover' && (
                  <span className="flex items-center gap-1 text-xs text-amber-600">
                    <span className="size-1.5 rounded-full bg-amber-500" />AI Paused
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="size-8">
                <Phone className="size-4 text-zinc-500" />
              </Button>
              <Button variant="ghost" size="icon" className="size-8">
                <Info className="size-4 text-zinc-500" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-zinc-100 transition-colors">
                  <MoreVertical className="size-4 text-zinc-500" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>View Contact</DropdownMenuItem>
                  <DropdownMenuItem>Add Note</DropdownMenuItem>
                  <DropdownMenuItem>Assign Agent</DropdownMenuItem>
                  <DropdownMenuItem>Archive</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">Block Contact</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Takeover / Paused Banner */}
          {currentConv?.status === 'human_takeover' && (
            <div className="flex items-center justify-between bg-blue-600 px-4 py-2 text-white text-xs">
              <div className="flex items-center gap-2">
                <UserRound className="size-3.5" />
                <span className="font-medium">Human Mode Active — You are handling this chat</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
                onClick={handleResumeAI}
              >
                Resume AI
              </Button>
            </div>
          )}
          {currentConv?.ai_mode === 'paused' && currentConv?.status !== 'human_takeover' && (
            <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-white text-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-3.5" />
                <span className="font-medium">AI Paused — Waiting for agent response</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
                  onClick={handleTakeover}
                >
                  Take Over
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent"
                  onClick={handleResumeAI}
                >
                  Resume AI
                </Button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <ScrollArea className="flex-1 px-4 py-4 chat-wallpaper">
            <div className="space-y-1">
              {groupedItems.map((item, i) => {
                if (item.type === 'separator') {
                  return (
                    <div key={`sep-${i}`} className="flex items-center gap-3 py-3">
                      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--wa-border)' }} />
                      <span
                        className="text-[10px] font-medium px-3 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--wa-surface)', color: 'var(--wa-text-secondary)' }}
                      >
                        {item.date}
                      </span>
                      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--wa-border)' }} />
                    </div>
                  )
                }
                const msg = item.message
                const isInbound = msg.direction === 'inbound'
                const isAI = msg.sender_type === 'ai'
                const isAgent = msg.sender_type === 'agent'

                return (
                  <div
                    key={msg.id}
                    className={cn(
                      'flex message-enter',
                      isInbound ? 'justify-start' : 'justify-end'
                    )}
                  >
                    <div
                      className={cn(
                        'relative max-w-[75%] rounded-lg px-3 py-2 text-sm shadow-sm',
                        isInbound ? 'rounded-tl-none' : 'rounded-tr-none'
                      )}
                      style={{
                        backgroundColor: isInbound
                          ? 'var(--wa-bubble-in)'
                          : isAI
                            ? 'var(--wa-bubble-out)'
                            : 'var(--wa-bubble-agent)',
                        color: isInbound
                          ? 'var(--wa-bubble-in-text)'
                          : isAI
                            ? 'var(--wa-bubble-out-text)'
                            : 'var(--wa-bubble-agent-text)',
                      }}
                    >
                      {/* AI/Agent label */}
                      {!isInbound && (
                        <div className="flex items-center gap-1 mb-1">
                          {isAI ? (
                            <span className="flex items-center gap-0.5 text-[10px] font-semibold" style={{ color: 'var(--wa-green)' }}>
                              <Sparkles className="size-2.5" /> AI
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-blue-600">Agent</span>
                          )}
                        </div>
                      )}
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <div className={cn(
                        'flex items-center gap-1 mt-1',
                        isInbound ? 'justify-start' : 'justify-end'
                      )}>
                        <span className="text-[10px]" style={{ color: 'var(--wa-text-tertiary)' }}>
                          {format(new Date(msg.sent_at), 'h:mm a')}
                        </span>
                        {!isInbound && <MessageStatus status={msg.status} />}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>

          {/* Message Input */}
          <div
            className="border-t px-4 py-3"
            style={{
              backgroundColor: 'var(--wa-surface)',
              borderColor: 'var(--wa-border)',
            }}
          >
            {/* AI status bar */}
            <div className="flex items-center justify-between mb-2 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                {currentConv?.ai_mode === 'enabled' ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <Bot className="size-3" /> AI: Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Bot className="size-3" /> AI: Paused
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {currentConv?.ai_mode === 'enabled' && (
                  <button
                    onClick={handleTakeover}
                    className="text-zinc-600 hover:text-zinc-900 font-medium transition-colors"
                  >
                    Pause AI
                  </button>
                )}
                {currentConv?.ai_mode !== 'enabled' && (
                  <button
                    onClick={handleResumeAI}
                    className="text-green-700 hover:text-green-900 font-medium transition-colors"
                  >
                    Resume AI
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-end gap-2">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Type a message..."
                rows={1}
                disabled={sending}
                className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                style={{ maxHeight: '120px', overflowY: 'auto' }}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!messageText.trim() || sending}
                className="size-9 shrink-0"
              >
                {sending
                  ? <RefreshCw className="size-4 animate-spin" />
                  : <Send className="size-4" />
                }
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden">
      {ConversationListPanel}
      {ChatWindowPanel}
    </div>
  )
}

// Placeholder icon to avoid import issues
function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  )
}

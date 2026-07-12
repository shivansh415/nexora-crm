'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import {
  Search,
  Filter,
  Pin,
  Plus,
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
  FileText,
  Paperclip,
  Mic,
  Square,
  X,
  ImageIcon,
  Pencil,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSupabaseClient } from '@/lib/supabase/client'
import type { Conversation, Message } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

// Display-only agent name for the New chat message preview.
// Mirrors WHATSAPP_AGENT_NAME used server-side in renderOutreachPreview().
const OUTREACH_AGENT_DISPLAY = 'Shivansh'

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
  if (status === 'read') return <CheckCheck className="size-3 text-blue-500" />
  if (status === 'delivered') return <CheckCheck className="size-3 text-zinc-400" />
  if (status === 'sent') return <Check className="size-3 text-zinc-400" />
  if (status === 'failed') {
    return (
      <span className="flex items-center gap-0.5 text-red-500" title="Not delivered by WhatsApp">
        <AlertCircle className="size-3" />
      </span>
    )
  }
  return null
}

// Renders a message body based on its type: image, audio/voice, video, document, or text.
function MessageBody({ msg }: { msg: Message }) {
  // content_type is a narrow union in the generated types, but the DB stores
  // extra kinds (audio/voice); treat as string for comparison.
  const type = msg.content_type as string
  const url = msg.media_url

  if (url && type === 'image') {
    return (
      <div className="space-y-1">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img
            src={url}
            alt={msg.content || 'Image'}
            className="max-h-64 w-auto rounded-md object-cover"
            loading="lazy"
          />
        </a>
        {msg.content && <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
      </div>
    )
  }

  if (url && (type === 'audio' || type === 'voice')) {
    return (
      <div className="min-w-[180px]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={url} className="w-full h-9" />
      </div>
    )
  }

  if (url && type === 'video') {
    return (
      <video controls src={url} className="max-h-64 w-auto rounded-md" />
    )
  }

  if (url && (type === 'document' || type === 'file')) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 underline"
      >
        <FileText className="size-4 shrink-0" />
        <span className="truncate">{msg.content || 'Document'}</span>
      </a>
    )
  }

  return <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
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
  const messagesScrollRef = useRef<HTMLDivElement>(null)

  // ── New chat dialog ──
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newName, setNewName] = useState('')
  const [startingChat, setStartingChat] = useState(false)

  // ── Edit / delete message ──
  const [editingMsg, setEditingMsg] = useState<Message | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingMsg, setDeletingMsg] = useState<Message | null>(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  // ── Delete whole conversation ──
  const [deleteConvOpen, setDeleteConvOpen] = useState(false)
  const [deletingConv, setDeletingConv] = useState(false)

  // ── Media attachment / voice recording ──
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingUrl, setPendingUrl] = useState<string>('')
  const [pendingKind, setPendingKind] = useState<'image' | 'voice' | null>(null)
  const [recording, setRecording] = useState(false)
  const [recordSecs, setRecordSecs] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      .order('timestamp', { ascending: true, nullsFirst: false })
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
  // Scroll ONLY the messages container (never the page) — scrollIntoView was
  // scrolling the whole document and cutting off the chat list & header.
  useEffect(() => {
    const el = messagesScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
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
            sent_at: row.timestamp ?? row.created_at,
            created_at: row.created_at,
          }
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev
            // Sort by actual message time (WhatsApp timestamp) so user messages
            // always appear before the AI reply, even if rows were inserted out of order
            return [...prev, newMsg].sort((a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime())
          })
        }
      )
      // Status changes (sent → delivered → read) and edits arrive as UPDATE events.
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConvId}`,
        },
        (payload) => {
          const row = payload.new as any
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    content: row.content ?? m.content,
                    status: row.status ?? m.status,
                    content_type: row.message_type ?? m.content_type,
                    media_url: row.media_url ?? m.media_url,
                    metadata: row.metadata ?? m.metadata,
                  }
                : m
            )
          )
        }
      )
      // Deleted messages disappear from the thread.
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const oldRow = payload.old as any
          if (!oldRow?.id) return
          setMessages((prev) => prev.filter((m) => m.id !== oldRow.id))
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
    if (!selectedConvId || sending) return
    // If there's a pending attachment (image or voice note), send that instead.
    if (pendingFile) {
      await handleSendMedia()
      return
    }
    if (!messageText.trim()) return
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
        toast.error(data.error ?? 'Failed to send message', {
          duration: data.windowClosed ? 8000 : 4000,
        })
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

  // ── Edit / delete a sent message ────────────────────────────────────────────
  function openEditMessage(msg: Message) {
    setEditingMsg(msg)
    setEditText(msg.content ?? '')
  }

  async function handleSaveEdit() {
    if (!editingMsg || !editText.trim() || savingEdit) return
    const id = editingMsg.id
    const newText = editText.trim()
    setSavingEdit(true)
    try {
      const res = await fetch('/api/messages/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: id, content: newText }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to edit message')
        return
      }
      // Optimistic update (realtime will confirm)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, content: newText, metadata: { ...(m.metadata as object), edited: true } }
            : m
        )
      )
      toast.success('Message updated')
      setEditingMsg(null)
      setEditText('')
    } catch {
      toast.error('Network error — could not edit message')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deletingMsg || deletingBusy) return
    const id = deletingMsg.id
    setDeletingBusy(true)
    try {
      const res = await fetch('/api/messages/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete message')
        return
      }
      setMessages((prev) => prev.filter((m) => m.id !== id))
      toast.success('Message deleted')
      setDeletingMsg(null)
    } catch {
      toast.error('Network error — could not delete message')
    } finally {
      setDeletingBusy(false)
    }
  }

  async function handleDeleteConversation() {
    if (!selectedConvId || deletingConv) return
    const id = selectedConvId
    setDeletingConv(true)
    try {
      const res = await fetch('/api/conversations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete chat')
        return
      }
      toast.success('Chat deleted')
      setConversations((prev) => prev.filter((c) => c.id !== id))
      setSelectedConvId(null)
      setMessages([])
      setShowMobileChat(false)
      setDeleteConvOpen(false)
    } catch {
      toast.error('Network error — could not delete chat')
    } finally {
      setDeletingConv(false)
    }
  }

  // ── Media: pick image ──────────────────────────────────────────────────────
  function onPickImage(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (file.size > 16 * 1024 * 1024) {
      toast.error('Image too large (max 16MB)')
      return
    }
    clearPending()
    setPendingFile(file)
    setPendingUrl(URL.createObjectURL(file))
    setPendingKind('image')
  }

  function clearPending() {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl)
    setPendingFile(null)
    setPendingUrl('')
    setPendingKind(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Media: send the pending attachment ─────────────────────────────────────
  async function handleSendMedia() {
    if (!pendingFile || !selectedConvId || sending) return
    setSending(true)
    try {
      const fd = new FormData()
      fd.append('file', pendingFile)
      fd.append('conversationId', selectedConvId)
      if (pendingKind === 'voice') fd.append('voice', 'true')
      if (pendingKind === 'image' && messageText.trim()) fd.append('caption', messageText.trim())

      const res = await fetch('/api/messages/send-media', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? data.details ?? 'Failed to send attachment', {
          duration: data.windowClosed ? 8000 : 4000,
        })
        return
      }
      setMessageText('')
      clearPending()
      // Realtime will append the message
    } catch {
      toast.error('Network error — could not send attachment')
    } finally {
      setSending(false)
    }
  }

  // ── Voice recording ─────────────────────────────────────────────────────────
  async function startRecording() {
    if (recording) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Prefer ogg/opus (accepted by WhatsApp); fall back to whatever the browser supports.
      const preferred = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mimeType = preferred.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) || ''
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recordedChunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) recordedChunksRef.current.push(e.data) }
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        const type = rec.mimeType || 'audio/ogg'
        const blob = new Blob(recordedChunksRef.current, { type })
        const ext = type.includes('ogg') ? 'ogg' : type.includes('mp4') ? 'm4a' : 'webm'
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type })
        clearPending()
        setPendingFile(file)
        setPendingUrl(URL.createObjectURL(blob))
        setPendingKind('voice')
      }
      mediaRecorderRef.current = rec
      rec.start()
      setRecording(true)
      setRecordSecs(0)
      recordTimerRef.current = setInterval(() => setRecordSecs((s) => s + 1), 1000)
    } catch {
      toast.error('Microphone access denied or unavailable')
    }
  }

  function stopRecording(save: boolean) {
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null }
    const rec = mediaRecorderRef.current
    if (!rec) { setRecording(false); return }
    if (!save) {
      // Discard: remove onstop handler so no pending file is created
      rec.onstop = () => rec.stream?.getTracks?.().forEach((t) => t.stop())
    }
    if (rec.state !== 'inactive') rec.stop()
    mediaRecorderRef.current = null
    setRecording(false)
    setRecordSecs(0)
  }

  // ── Start a new chat with a fresh number ───────────────────────────────────
  async function handleStartChat() {
    if (!newPhone.trim() || startingChat) return
    setStartingChat(true)
    try {
      const res = await fetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: newPhone.trim(), name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to start chat')
        return
      }
      toast.success(data.existed ? 'Opening existing conversation' : 'Outreach message sent')
      // Refresh list, open the conversation
      await fetchConversations()
      setSelectedConvId(data.conversationId)
      setShowMobileChat(true)
      setNewChatOpen(false)
      setNewPhone('')
      setNewName('')
    } catch {
      toast.error('Network error — could not start chat')
    } finally {
      setStartingChat(false)
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

  // 24-hour customer-care window: WhatsApp only delivers free-form (non-template)
  // messages if the contact messaged within the last 24h. Derive it from the
  // newest inbound message so we can warn the agent before they send.
  const lastInboundAt = messages.reduce<string | null>((acc, m) => {
    if (m.direction !== 'inbound') return acc
    if (!acc || new Date(m.sent_at).getTime() > new Date(acc).getTime()) return m.sent_at
    return acc
  }, null)
  const windowOpen =
    !!lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000

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
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setNewChatOpen(true)}
            title="New chat"
          >
            <Plus className="size-4 text-zinc-500" />
          </Button>
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
      <div className="flex-1 min-h-0 overflow-y-auto">
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
      </div>
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
                  <DropdownMenuItem variant="destructive" onClick={() => setDeleteConvOpen(true)}>
                    <Trash2 className="size-4" /> Delete chat
                  </DropdownMenuItem>
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
          <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 chat-wallpaper">
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
                      'group flex items-center gap-1 message-enter',
                      isInbound ? 'justify-start' : 'justify-end'
                    )}
                  >
                    {!isInbound && (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          className="shrink-0 rounded-full p-1 text-zinc-400 opacity-0 transition hover:bg-black/5 hover:text-zinc-600 focus-visible:opacity-100 group-hover:opacity-100 data-[popup-open]:opacity-100"
                          title="Message actions"
                        >
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          {(msg.content_type as string) === 'text' && (
                            <DropdownMenuItem onClick={() => openEditMessage(msg)}>
                              <Pencil className="size-4" /> Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem variant="destructive" onClick={() => setDeletingMsg(msg)}>
                            <Trash2 className="size-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
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
                      <MessageBody msg={msg} />
                      <div className={cn(
                        'flex items-center gap-1 mt-1',
                        isInbound ? 'justify-start' : 'justify-end'
                      )}>
                        {Boolean((msg.metadata as { edited?: boolean } | null)?.edited) && (
                          <span className="text-[10px] italic" style={{ color: 'var(--wa-text-tertiary)' }}>
                            edited
                          </span>
                        )}
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
          </div>

          {/* Message Input */}
          <div
            className="border-t px-4 py-3"
            style={{
              backgroundColor: 'var(--wa-surface)',
              borderColor: 'var(--wa-border)',
            }}
          >
            {/* 24-hour window notice — free messages won't deliver when closed */}
            {selectedConvId && messages.length > 0 && !windowOpen && (
              <div className="mb-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                <span>
                  <span className="font-medium">24-hour reply window closed.</span>{' '}
                  {lastInboundAt
                    ? `${currentConv?.contact?.name ?? 'This contact'} hasn't replied in over 24 hours, `
                    : `${currentConv?.contact?.name ?? 'This contact'} hasn't messaged you yet, `}
                  so WhatsApp won&apos;t deliver a normal message. Send the approved template via{' '}
                  <button onClick={() => setNewChatOpen(true)} className="font-medium underline underline-offset-2 hover:text-amber-900">
                    New chat
                  </button>{' '}
                  to re-open it — free replies unlock for 24h once they message back.
                </span>
              </div>
            )}
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
            {/* Pending attachment preview */}
            {pendingFile && (
              <div className="mb-2 flex items-center gap-3 rounded-lg border border-zinc-200 bg-white/60 p-2">
                {pendingKind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pendingUrl} alt="preview" className="size-12 rounded object-cover" />
                ) : (
                  <div className="flex items-center gap-2 flex-1">
                    <Mic className="size-4 text-zinc-500 shrink-0" />
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls src={pendingUrl} className="h-8 flex-1" />
                  </div>
                )}
                <span className="flex-1 truncate text-xs text-zinc-500">
                  {pendingKind === 'image' ? (pendingFile.name || 'Image') : 'Voice message'}
                </span>
                <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={clearPending} disabled={sending}>
                  <X className="size-4 text-zinc-500" />
                </Button>
              </div>
            )}

            {/* Hidden file input for images */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickImage(f) }}
            />

            {recording ? (
              // Recording bar
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <span className="flex items-center gap-2 text-sm text-red-600 font-medium flex-1">
                  <span className="size-2.5 rounded-full bg-red-500 animate-pulse" />
                  Recording… {String(Math.floor(recordSecs / 60)).padStart(2, '0')}:{String(recordSecs % 60).padStart(2, '0')}
                </span>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => stopRecording(false)} title="Cancel">
                  <X className="size-4 text-zinc-500" />
                </Button>
                <Button size="icon" className="size-9" onClick={() => stopRecording(true)} title="Stop & attach">
                  <Square className="size-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-2">
                {/* Attach image */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  title="Attach image"
                >
                  <ImageIcon className="size-4 text-zinc-500" />
                </Button>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder={pendingKind === 'image' ? 'Add a caption…' : 'Type a message...'}
                  rows={1}
                  disabled={sending}
                  className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
                  style={{ maxHeight: '120px', overflowY: 'auto' }}
                />
                {/* Voice note (when nothing typed and no pending) OR Send */}
                {!messageText.trim() && !pendingFile ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 shrink-0"
                    onClick={startRecording}
                    disabled={sending}
                    title="Record voice note"
                  >
                    <Mic className="size-4 text-zinc-500" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={(!messageText.trim() && !pendingFile) || sending}
                    className="size-9 shrink-0"
                  >
                    {sending
                      ? <RefreshCw className="size-4 animate-spin" />
                      : <Send className="size-4" />
                    }
                  </Button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )

  // ─── New Chat Dialog ──────────────────────────────────────────────────────
  const previewName = newName.trim() || 'there'
  // Mirrors the approved `ad_lead_message` template body (renderOutreachPreview in lib/whatsapp.ts).
  const messagePreview = `Hi ${previewName}, this is ${OUTREACH_AGENT_DISPLAY} from Nexora Lab. I saw your enquiry and wanted to personally reach out. What do you want to Automate, We Help business to Grow with AI Agents.`

  const NewChatDialog = (
    <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        {/* Header */}
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-zinc-100 px-5 py-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-wa-green/10 text-wa-green">
            <Send className="size-[18px]" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-[15px] font-semibold text-zinc-900">Start a new chat</DialogTitle>
            <DialogDescription className="text-[12.5px] leading-snug text-zinc-500">
              Reach out to a number that hasn&apos;t messaged you yet.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-name" className="text-[13px] font-medium text-zinc-700">
                Name <span className="font-normal text-zinc-400">(optional)</span>
              </Label>
              <Input
                id="new-name"
                placeholder="Rahul Sharma"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-phone" className="text-[13px] font-medium text-zinc-700">Phone number</Label>
              <Input
                id="new-phone"
                inputMode="tel"
                placeholder="+91 98765 43210"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleStartChat() }}
                className="h-10"
              />
            </div>
          </div>
          <p className="-mt-1.5 text-[11.5px] text-zinc-400">
            With or without +91 — Indian numbers are auto-formatted.
          </p>

          {/* Message preview */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Message preview</p>
            <div className="rounded-lg bg-[var(--wa-chat-bg)] p-3">
              <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-white px-3 py-2 text-[13px] leading-relaxed text-zinc-800 shadow-sm">
                {messagePreview}
              </div>
            </div>
          </div>

          {/* Info callout */}
          <div className="flex gap-2.5 rounded-lg border border-wa-green/15 bg-wa-green/5 p-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-wa-green" />
            <p className="text-[12px] leading-relaxed text-zinc-600">
              WhatsApp requires an approved template for the first message, so we send{' '}
              <span className="font-medium text-zinc-800">ad_lead_message</span> automatically. The moment they reply, the AI takes over the conversation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-100 bg-zinc-50/70 px-5 py-3.5">
          <Button variant="outline" onClick={() => setNewChatOpen(false)} disabled={startingChat}>
            Cancel
          </Button>
          <Button onClick={handleStartChat} disabled={!newPhone.trim() || startingChat} className="gap-1.5" size="lg">
            {startingChat
              ? <><RefreshCw className="size-4 animate-spin" /> Sending…</>
              : <><Send className="size-4" /> Send message</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  // ─── Edit Message Dialog ──────────────────────────────────────────────────
  const EditMessageDialog = (
    <Dialog open={!!editingMsg} onOpenChange={(o) => { if (!o) { setEditingMsg(null); setEditText('') } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit message</DialogTitle>
          <DialogDescription>
            This updates the message in your CRM only. WhatsApp can&apos;t change a message that was already delivered to the contact.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          rows={4}
          autoFocus
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveEdit() }}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setEditingMsg(null); setEditText('') }} disabled={savingEdit}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} disabled={!editText.trim() || savingEdit} className="gap-1.5">
            {savingEdit ? <><RefreshCw className="size-4 animate-spin" /> Saving…</> : 'Save changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  // ─── Delete Message Dialog ────────────────────────────────────────────────
  const DeleteMessageDialog = (
    <Dialog open={!!deletingMsg} onOpenChange={(o) => { if (!o) setDeletingMsg(null) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete message?</DialogTitle>
          <DialogDescription>
            This removes the message from your CRM. The contact keeps the copy already delivered on WhatsApp. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        {deletingMsg?.content && (
          <p className="line-clamp-3 rounded-lg border border-zinc-100 bg-zinc-50 p-2.5 text-[13px] text-zinc-600">
            {deletingMsg.content}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeletingMsg(null)} disabled={deletingBusy}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirmDelete} disabled={deletingBusy} className="gap-1.5">
            {deletingBusy ? <><RefreshCw className="size-4 animate-spin" /> Deleting…</> : <><Trash2 className="size-4" /> Delete</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="flex h-[calc(100dvh-4rem)] md:h-dvh overflow-hidden">
      {ConversationListPanel}
      {ChatWindowPanel}
      {NewChatDialog}
      {EditMessageDialog}
      {DeleteMessageDialog}
      <Dialog open={deleteConvOpen} onOpenChange={(o) => { if (!o) setDeleteConvOpen(false) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              This permanently deletes the entire conversation and all its messages from your database. This frees up storage and can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConvOpen(false)} disabled={deletingConv}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConversation} disabled={deletingConv} className="gap-1.5">
              {deletingConv ? <><RefreshCw className="size-4 animate-spin" /> Deleting…</> : <><Trash2 className="size-4" /> Delete chat</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendReengageTemplate, renderOutreachPreview } from '@/lib/whatsapp'

export const runtime = 'nodejs'

const WORKSPACE_ID = 'f38c0ad0-d4ef-4090-94eb-50d3f6a21bce'
const WINDOW_MS = 24 * 60 * 60 * 1000

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST /api/conversations/reengage
// Body: { conversationId: string }
// Re-opens a conversation whose 24-hour customer-care window has CLOSED by
// sending the approved re-engagement template. This is the ONLY compliant way to
// message a known contact who hasn't replied in >24h. When the contact replies,
// the AI takes over again (ai_paused stays false).
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { conversationId } = await req.json() as { conversationId: string }
    if (!conversationId) {
      return NextResponse.json({ error: 'Missing conversationId' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Resolve contact phone + name
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('id, contact_id, contacts(name, phone_number)')
      .eq('id', conversationId)
      .single()

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    const contact = (conv as unknown as { contacts?: { name?: string; phone_number?: string } }).contacts
    const phone = contact?.phone_number
    if (!phone) {
      return NextResponse.json({ error: 'Contact phone number not found' }, { status: 404 })
    }

    // If the window is still OPEN, no template is needed — the agent can send a
    // normal message. Tell the UI so it doesn't spend a paid template needlessly.
    const { data: lastInbound } = await supabase
      .from('messages')
      .select('timestamp, created_at')
      .eq('conversation_id', conversationId)
      .eq('direction', 'inbound')
      .order('timestamp', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)

    const lastInboundAt = lastInbound?.[0]?.timestamp ?? lastInbound?.[0]?.created_at ?? null
    const windowOpen = !!lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < WINDOW_MS
    if (windowOpen) {
      return NextResponse.json({ ok: true, alreadyOpen: true, sent: false })
    }

    // Send the approved re-engagement template (retries handled in the WA client)
    const result = await sendReengageTemplate(phone, contact?.name || '')
    if (!result.ok) {
      return NextResponse.json(
        { error: `Template send failed: ${result.error ?? 'unknown error'}`, errorCode: result.errorCode },
        { status: 502 },
      )
    }

    const nowIso = new Date().toISOString()
    const previewText = renderOutreachPreview(contact?.name || '')

    // Log the outbound template message so it shows in the chat + ticks update via status webhook
    await supabase.from('messages').insert({
      workspace_id: WORKSPACE_ID,
      conversation_id: conversationId,
      wa_message_id: result.waMessageId || `reengage_${Date.now()}`,
      direction: 'outbound',
      sender_type: 'agent',
      sender_id: user.id,
      message_type: 'template',
      content: previewText,
      status: 'sent',
      is_ai_generated: false,
      timestamp: nowIso,
    })

    // Keep AI armed so it auto-replies once the contact responds
    await supabase
      .from('conversations')
      .update({
        status: 'active',
        ai_paused: false,
        last_message_at: nowIso,
        last_message_preview: previewText.slice(0, 100),
        updated_at: nowIso,
      })
      .eq('id', conversationId)

    return NextResponse.json({ ok: true, sent: true, whatsappMessageId: result.waMessageId })
  } catch (err) {
    console.error('[conversations/reengage] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

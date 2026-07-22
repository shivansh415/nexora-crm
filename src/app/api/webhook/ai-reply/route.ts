import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKSPACE_ID = 'f38c0ad0-d4ef-4090-94eb-50d3f6a21bce'
const WEBHOOK_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-12) || 'crm-webhook-secret'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

interface AiReplyPayload {
  phone: string
  replyText: string
  messageId?: string
  // Optional: n8n reports whether Meta actually accepted the send. Defaults to
  // 'sent' for backward compatibility. When 'failed', we log it as failed so the
  // agent sees the AI reply never went out (instead of a false "sent").
  status?: 'sent' | 'failed' | 'delivered'
}

const ALLOWED_STATUS = new Set(['sent', 'failed', 'delivered'])

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-webhook-secret')
    if (authHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: AiReplyPayload = await request.json()
    const { phone, replyText, messageId } = body
    const status = ALLOWED_STATUS.has(String(body.status)) ? body.status! : 'sent'

    if (!phone || !replyText) {
      return NextResponse.json({ error: 'Missing phone or replyText' }, { status: 400 })
    }

    const supabase = getSupabase()

    // ── 1. Find the contact ──
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('phone_number', phone)
      .limit(1)

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'Contact not found for phone: ' + phone }, { status: 404 })
    }

    // ── 2. Find the conversation ──
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('contact_id', contacts[0].id)
      .limit(1)

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const conversationId = conversations[0].id

    // ── 3. Save AI Reply Message ──
    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        workspace_id: WORKSPACE_ID,
        conversation_id: conversationId,
        wa_message_id: messageId || `ai_reply_${Date.now()}`,
        direction: 'outbound',
        sender_type: 'ai',
        message_type: 'text',
        content: replyText,
        status,
        is_ai_generated: true,
        timestamp: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (msgErr) {
      // Idempotent: a duplicate delivery already logged this reply.
      if ((msgErr as { code?: string }).code === '23505') {
        return NextResponse.json({ success: true, duplicate: true })
      }
      return NextResponse.json({ error: 'Failed to save AI reply', details: msgErr?.message }, { status: 500 })
    }

    // ── 4. Update conversation preview (skip when the send failed) ──
    if (status !== 'failed') {
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: replyText.slice(0, 100),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
    }

    return NextResponse.json({ success: true, messageId: msg?.id, status })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('AI reply webhook error:', errorMessage)
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKSPACE_ID = 'f38c0ad0-d4ef-4090-94eb-50d3f6a21bce'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check — use anon client for auth, admin for DB writes
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId, workspaceId, message } = await req.json() as {
      conversationId: string
      workspaceId: string
      message: string
    }

    if (!conversationId || !message?.trim()) {
      return NextResponse.json({ error: 'Missing conversationId or message' }, { status: 400 })
    }

    const supabase = getSupabase()

    // 2. Get the contact's phone number from this conversation
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .select('contact_id, contacts(phone_number)')
      .eq('id', conversationId)
      .single()

    if (convErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const phone = (conv as any).contacts?.phone_number
    if (!phone) {
      return NextResponse.json({ error: 'Contact phone number not found' }, { status: 404 })
    }

    // 2b. Enforce WhatsApp's 24-hour customer-care window.
    // A free-form (non-template) message is only DELIVERED if the contact has
    // messaged us within the last 24h. Outside that window Meta still returns
    // HTTP 200 with a message id (so it looks "sent") but silently drops it.
    // We block it here so the agent gets an honest, actionable error instead of
    // a message that never arrives.
    const { data: lastInbound } = await supabase
      .from('messages')
      .select('timestamp, created_at')
      .eq('conversation_id', conversationId)
      .eq('direction', 'inbound')
      .order('timestamp', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)

    const lastInboundAt = lastInbound?.[0]?.timestamp ?? lastInbound?.[0]?.created_at ?? null
    const withinWindow =
      !!lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000

    if (!withinWindow) {
      return NextResponse.json(
        {
          error: lastInboundAt
            ? "This contact hasn't replied in the last 24 hours, so WhatsApp won't deliver a normal message. Send the approved template (New chat) to re-open the chat — free replies work for 24h after they message back."
            : "This contact hasn't messaged you yet, so WhatsApp won't deliver a normal message. Use New chat to send the approved template first — free replies unlock once they reply.",
          code: 'WINDOW_CLOSED',
          windowClosed: true,
          canReengage: true,
        },
        { status: 409 }
      )
    }

    // 3. Send via Meta WhatsApp Cloud API directly
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN

    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({
        error: 'WhatsApp credentials not configured',
        hint: 'Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to .env.local',
      }, { status: 503 })
    }

    const waRes = await fetch(
      `https://graph.facebook.com/v23.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          type: 'text',
          text: { preview_url: false, body: message.trim() },
        }),
      }
    )

    const waData = await waRes.json()

    if (!waRes.ok) {
      console.error('[send] WhatsApp API error:', waData)
      return NextResponse.json({
        error: 'WhatsApp API error',
        details: waData?.error?.message || JSON.stringify(waData).slice(0, 300),
      }, { status: 502 })
    }

    const waMsgId = waData?.messages?.[0]?.id || `agent_${Date.now()}`

    // 4. Save the agent message to Supabase
    const { data: savedMsg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        workspace_id: workspaceId || WORKSPACE_ID,
        conversation_id: conversationId,
        wa_message_id: waMsgId,
        direction: 'outbound',
        sender_type: 'agent',
        sender_id: user.id,
        message_type: 'text',
        content: message.trim(),
        status: 'sent',
        is_ai_generated: false,
        timestamp: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (msgErr) {
      console.error('[send] Failed to save message to DB:', msgErr)
      // Message was sent via WhatsApp but DB save failed — not critical
    }

    // 5. Update conversation metadata
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.trim().slice(0, 100),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    return NextResponse.json({
      ok: true,
      messageId: savedMsg?.id ?? null,
      whatsappMessageId: waMsgId,
    })
  } catch (err) {
    console.error('[send] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

interface InboundPayload {
  phone: string
  profileName?: string
  message?: string
  messageId?: string
  messageType?: string
  wa_id?: string
  timestamp?: string
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-webhook-secret')
    if (authHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: InboundPayload = await request.json()
    const { phone, profileName, message, messageId, messageType, wa_id, timestamp } = body

    if (!phone) {
      return NextResponse.json({ error: 'Missing phone number' }, { status: 400 })
    }

    const supabase = getSupabase()

    // ── 1. Upsert Contact ──
    let contactId: string

    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('phone_number', phone)
      .limit(1)

    if (existingContacts && existingContacts.length > 0) {
      contactId = existingContacts[0].id
      if (profileName) {
        await supabase
          .from('contacts')
          .update({ name: profileName, updated_at: new Date().toISOString() })
          .eq('id', contactId)
      }
    } else {
      const { data: newContact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          workspace_id: WORKSPACE_ID,
          phone_number: phone,
          name: profileName || phone,
          source: 'whatsapp',
          wa_id: wa_id || phone,
        })
        .select('id')
        .single()

      if (contactErr || !newContact) {
        return NextResponse.json({ error: 'Failed to create contact', details: contactErr?.message }, { status: 500 })
      }
      contactId = newContact.id
    }

    // ── 2. Upsert Conversation ──
    let conversationId: string

    const { data: existingConvs } = await supabase
      .from('conversations')
      .select('id')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('contact_id', contactId)
      .limit(1)

    if (existingConvs && existingConvs.length > 0) {
      conversationId = existingConvs[0].id
      await supabase
        .from('conversations')
        .update({
          status: 'active',
          last_message_at: new Date().toISOString(),
          last_message_preview: (message || '').slice(0, 100),
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
    } else {
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          workspace_id: WORKSPACE_ID,
          contact_id: contactId,
          status: 'active',
          channel: 'whatsapp',
          last_message_at: new Date().toISOString(),
          last_message_preview: (message || '').slice(0, 100),
        })
        .select('id')
        .single()

      if (convErr || !newConv) {
        return NextResponse.json({ error: 'Failed to create conversation', details: convErr?.message }, { status: 500 })
      }
      conversationId = newConv.id
    }

    // ── 3. Save Inbound Message ──
    const msgTimestamp = timestamp
      ? new Date(Number(timestamp) * 1000).toISOString()
      : new Date().toISOString()

    const { data: msg, error: msgErr } = await supabase
      .from('messages')
      .insert({
        workspace_id: WORKSPACE_ID,
        conversation_id: conversationId,
        wa_message_id: messageId || `inbound_${Date.now()}`,
        direction: 'inbound',
        sender_type: 'contact',
        message_type: messageType || 'text',
        content: message || '',
        status: 'delivered',
        is_ai_generated: false,
        timestamp: msgTimestamp,
      })
      .select('id')
      .single()

    if (msgErr) {
      return NextResponse.json({ error: 'Failed to save message', details: msgErr?.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, contactId, conversationId, messageId: msg?.id })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Inbound webhook error:', errorMessage)
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

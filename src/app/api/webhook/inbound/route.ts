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

function calculateLeadScore(messageCount: number): number {
  if (messageCount >= 10) return 85  // Hot
  if (messageCount >= 5) return 60   // Warm
  if (messageCount >= 2) return 35   // Cool
  return 10                           // Cold
}

function getLeadTags(messageCount: number, profileName?: string): string[] {
  const tags: string[] = ['WhatsApp']
  if (messageCount >= 10) tags.push('🔥 Hot Lead')
  else if (messageCount >= 5) tags.push('♨️ Warm Lead')
  else tags.push('❄️ Cold Lead')
  return tags
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
    let isNewContact = false

    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id, lead_score, tags')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('phone_number', phone)
      .limit(1)

    if (existingContacts && existingContacts.length > 0) {
      contactId = existingContacts[0].id
      if (profileName) {
        await supabase
          .from('contacts')
          .update({ name: profileName, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', contactId)
      } else {
        await supabase
          .from('contacts')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', contactId)
      }
    } else {
      isNewContact = true
      const { data: newContact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          workspace_id: WORKSPACE_ID,
          phone_number: phone,
          name: profileName || phone,
          source: 'whatsapp',
          wa_id: wa_id || phone,
          lead_score: 10,
          tags: ['WhatsApp', '❄️ Cold Lead'],
          last_seen_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (contactErr || !newContact) {
        return NextResponse.json({ error: 'Failed to create contact', details: contactErr?.message }, { status: 500 })
      }
      contactId = newContact.id
    }

    // Actual time the user sent the message on WhatsApp (Meta timestamp).
    // Using this (instead of insert time) keeps ordering correct even when
    // the AI reply reaches the CRM before this inbound sync does.
    const inboundSentAt = timestamp
      ? new Date(Number(timestamp) * 1000).toISOString()
      : new Date().toISOString()

    // ── 2. Upsert Conversation ──
    let conversationId: string

    const { data: existingConvs } = await supabase
      .from('conversations')
      .select('id, unread_count, last_message_at')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('contact_id', contactId)
      .limit(1)

    if (existingConvs && existingConvs.length > 0) {
      conversationId = existingConvs[0].id
      const currentUnread = existingConvs[0].unread_count ?? 0
      const existingLastAt = existingConvs[0].last_message_at
      // Only overwrite the preview if this message is newer than the current one
      const isNewer = !existingLastAt || new Date(inboundSentAt) >= new Date(existingLastAt)
      await supabase
        .from('conversations')
        .update({
          status: 'active',
          ...(isNewer
            ? {
                last_message_at: inboundSentAt,
                last_message_preview: (message || '').slice(0, 100),
              }
            : {}),
          unread_count: currentUnread + 1,
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
          last_message_at: inboundSentAt,
          last_message_preview: (message || '').slice(0, 100),
          unread_count: 1,
        })
        .select('id')
        .single()

      if (convErr || !newConv) {
        return NextResponse.json({ error: 'Failed to create conversation', details: convErr?.message }, { status: 500 })
      }
      conversationId = newConv.id
    }

    // ── 3. Save Inbound Message ──
    const msgTimestamp = inboundSentAt

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

    // ── 4. Auto-create Lead for new contacts ──
    let leadId: string | null = null
    if (isNewContact) {
      const { data: newLead } = await supabase
        .from('leads')
        .insert({
          workspace_id: WORKSPACE_ID,
          contact_id: contactId,
          conversation_id: conversationId,
          title: `${profileName || phone} — WhatsApp Enquiry`,
          stage: 'new',
          priority: 'medium',
          tags: ['WhatsApp', '❄️ Cold Lead'],
          notes: `First message: "${(message || '').slice(0, 200)}"`,
        })
        .select('id')
        .single()
      leadId = newLead?.id ?? null
    }

    // ── 5. Update lead score based on message count ──
    const { count: msgCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .eq('direction', 'inbound')

    const score = calculateLeadScore(msgCount ?? 1)
    const tags = getLeadTags(msgCount ?? 1, profileName)

    await supabase
      .from('contacts')
      .update({ lead_score: score, tags, updated_at: new Date().toISOString() })
      .eq('id', contactId)

    // Update lead stage based on engagement  
    if (!isNewContact && msgCount && msgCount >= 3) {
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, stage')
        .eq('workspace_id', WORKSPACE_ID)
        .eq('contact_id', contactId)
        .limit(1)
        .single()

      if (existingLead && existingLead.stage === 'new') {
        await supabase
          .from('leads')
          .update({ stage: 'contacted', updated_at: new Date().toISOString() })
          .eq('id', existingLead.id)
      }
    }

    // ── 6. Auto-create Enquiry for new contacts ──
    if (isNewContact) {
      await supabase
        .from('enquiries')
        .insert({
          workspace_id: WORKSPACE_ID,
          contact_id: contactId,
          conversation_id: conversationId,
          name: profileName || phone,
          phone_number: phone,
          source: 'whatsapp',
          status: 'new',
          notes: `First message: "${(message || '').slice(0, 500)}"`,
        })
        .select('id')
        .single()
    }

    return NextResponse.json({ success: true, contactId, conversationId, messageId: msg?.id, leadId, isNewContact })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('Inbound webhook error:', errorMessage)
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone'
import { sendOutreachTemplate, renderOutreachPreview } from '@/lib/whatsapp'

const WORKSPACE_ID = 'f38c0ad0-d4ef-4090-94eb-50d3f6a21bce'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST /api/conversations/start
// Body: { phone: string, name?: string }
// Starts a NEW conversation with a cold number by sending the approved outreach
// template, then creates the contact + conversation (AI armed) so the AI takes
// over once the lead replies. If the contact already exists, it just returns the
// existing conversation so the UI can open it (no template re-send).
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { phone: rawPhone, name: rawName } = await req.json() as { phone: string; name?: string }

    const { value: phone, reason } = normalizePhone(rawPhone)
    if (!phone) {
      return NextResponse.json({ error: `Invalid phone number (${reason ?? 'unrecognized format'})` }, { status: 400 })
    }
    const name = (rawName || '').trim()

    const supabase = getSupabase()

    // ── If contact already exists, return its conversation (open, don't re-message) ──
    const { data: existingContacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('phone_number', phone)
      .limit(1)

    if (existingContacts && existingContacts.length > 0) {
      const contactId = existingContacts[0].id
      const { data: existingConvs } = await supabase
        .from('conversations')
        .select('id')
        .eq('workspace_id', WORKSPACE_ID)
        .eq('contact_id', contactId)
        .limit(1)

      if (existingConvs && existingConvs.length > 0) {
        return NextResponse.json({ ok: true, conversationId: existingConvs[0].id, existed: true })
      }

      // Contact exists but no conversation — create one (no template send)
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          workspace_id: WORKSPACE_ID,
          contact_id: contactId,
          status: 'active',
          channel: 'whatsapp',
          ai_paused: false,
          unread_count: 0,
        })
        .select('id')
        .single()
      if (convErr || !conv) {
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }
      return NextResponse.json({ ok: true, conversationId: conv.id, existed: true })
    }

    // ── New cold number: send the approved outreach template ──
    const result = await sendOutreachTemplate(phone, name)
    if (!result.ok) {
      return NextResponse.json({ error: `WhatsApp send failed: ${result.error ?? 'unknown error'}` }, { status: 502 })
    }

    // Create contact
    const { data: newContact, error: contactErr } = await supabase
      .from('contacts')
      .insert({
        workspace_id: WORKSPACE_ID,
        phone_number: phone,
        name: name || phone,
        source: 'manual',
        wa_id: phone,
        lead_score: 10,
        tags: ['Manual Outreach', 'Outreach Sent'],
        last_seen_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (contactErr || !newContact) {
      return NextResponse.json({ error: 'Message sent but failed to save contact: ' + (contactErr?.message ?? '') }, { status: 500 })
    }

    const nowIso = new Date().toISOString()
    const previewText = renderOutreachPreview(name)

    // Create conversation with AI ARMED
    const { data: newConv, error: convErr } = await supabase
      .from('conversations')
      .insert({
        workspace_id: WORKSPACE_ID,
        contact_id: newContact.id,
        status: 'active',
        channel: 'whatsapp',
        ai_paused: false,
        last_message_at: nowIso,
        last_message_preview: previewText.slice(0, 100),
        unread_count: 0,
      })
      .select('id')
      .single()

    if (convErr || !newConv) {
      return NextResponse.json({ error: 'Message sent but failed to create conversation' }, { status: 500 })
    }

    // Save the outbound template message
    await supabase.from('messages').insert({
      workspace_id: WORKSPACE_ID,
      conversation_id: newConv.id,
      wa_message_id: result.waMessageId || `outreach_${Date.now()}`,
      direction: 'outbound',
      sender_type: 'agent',
      sender_id: user.id,
      message_type: 'template',
      content: previewText,
      status: 'sent',
      is_ai_generated: false,
      timestamp: nowIso,
    })

    // Create a lead in the pipeline
    await supabase.from('leads').insert({
      workspace_id: WORKSPACE_ID,
      contact_id: newContact.id,
      conversation_id: newConv.id,
      title: `${name || phone} — Manual Outreach`,
      stage: 'contacted',
      priority: 'medium',
      tags: ['Manual Outreach', 'Outreach Sent'],
      notes: 'First outreach template sent manually from chats.',
    })

    return NextResponse.json({ ok: true, conversationId: newConv.id, existed: false })
  } catch (err) {
    console.error('[conversations/start] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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

interface AppointmentPayload {
  action?: 'book' | 'cancel' // defaults to 'book' for backward compatibility
  phone: string
  name?: string
  title?: string
  startTime?: string // ISO string, e.g. "2026-07-10T15:00:00+05:30"
  endTime?: string
  location?: string
  notes?: string // business, requirement, budget, service interested
  googleEventId?: string
  conversationId?: string
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-webhook-secret')
    if (authHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: AppointmentPayload = await request.json()
    const { phone, name, title, startTime, endTime, location, notes, googleEventId, conversationId } = body
    const action = body.action ?? 'book'

    if (!phone) {
      return NextResponse.json({ error: 'Missing required field: phone' }, { status: 400 })
    }

    const supabase = getSupabase()

    // ── Find contact (create as fallback so booking never fails) ──
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('phone_number', phone)
      .limit(1)

    let contactId: string
    let contactName: string

    if (contacts && contacts.length > 0) {
      contactId = contacts[0].id
      contactName = contacts[0].name
    } else {
      const { data: newContact, error: contactErr } = await supabase
        .from('contacts')
        .insert({
          workspace_id: WORKSPACE_ID,
          phone_number: phone,
          name: name || phone,
          source: 'whatsapp',
          wa_id: phone,
          lead_score: 60,
          tags: ['WhatsApp', '♨️ Warm Lead'],
          last_seen_at: new Date().toISOString(),
        })
        .select('id, name')
        .single()

      if (contactErr || !newContact) {
        return NextResponse.json({ error: 'Contact not found and could not be created', details: contactErr?.message }, { status: 500 })
      }
      contactId = newContact.id
      contactName = newContact.name
    }

    // ═══ CANCEL ═══
    if (action === 'cancel') {
      let query = supabase
        .from('appointments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('workspace_id', WORKSPACE_ID)
        .eq('contact_id', contactId)
        .in('status', ['scheduled', 'confirmed'])

      if (googleEventId) {
        query = query.eq('google_event_id', googleEventId)
      }

      const { error: cancelErr } = await query
      if (cancelErr) {
        return NextResponse.json({ error: 'Failed to cancel appointment', details: cancelErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, action: 'cancelled' })
    }

    // ═══ BOOK ═══
    if (!startTime) {
      return NextResponse.json({ error: 'Missing required field: startTime' }, { status: 400 })
    }

    const start = new Date(startTime)
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: 'Invalid startTime — must be ISO 8601' }, { status: 400 })
    }
    const end = endTime && !Number.isNaN(new Date(endTime).getTime())
      ? new Date(endTime)
      : new Date(start.getTime() + 30 * 60 * 1000) // default 30 min consultation

    // Dedup: skip insert if identical active appointment already exists
    const { data: existing } = await supabase
      .from('appointments')
      .select('id')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('contact_id', contactId)
      .eq('start_time', start.toISOString())
      .in('status', ['scheduled', 'confirmed'])
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, action: 'booked', appointmentId: existing[0].id, deduped: true })
    }

    // Find linked conversation if not provided
    let convId = conversationId ?? null
    if (!convId) {
      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .eq('workspace_id', WORKSPACE_ID)
        .eq('contact_id', contactId)
        .limit(1)
      convId = convs?.[0]?.id ?? null
    }

    // Find linked lead
    const { data: leads } = await supabase
      .from('leads')
      .select('id, stage')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('contact_id', contactId)
      .limit(1)
    const lead = leads?.[0] ?? null

    const { data: apt, error: aptErr } = await supabase
      .from('appointments')
      .insert({
        workspace_id: WORKSPACE_ID,
        contact_id: contactId,
        lead_id: lead?.id ?? null,
        conversation_id: convId,
        title: title || `Nexora Lab Consultation - ${name || contactName}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'confirmed',
        booked_by: 'ai',
        location: location || 'Google Meet / Phone Call',
        notes: notes || null,
        google_event_id: googleEventId || null,
      })
      .select('id')
      .single()

    if (aptErr) {
      return NextResponse.json({ error: 'Failed to create appointment', details: aptErr?.message }, { status: 500 })
    }

    // Advance lead to qualified — they booked a consultation
    if (lead && !['won', 'lost'].includes(lead.stage)) {
      await supabase
        .from('leads')
        .update({ stage: 'qualified', updated_at: new Date().toISOString() })
        .eq('id', lead.id)
    }

    // Mark contact as hot
    await supabase
      .from('contacts')
      .update({
        lead_score: 90,
        tags: ['WhatsApp', '🔥 Hot Lead', '📅 Appointment Booked'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    return NextResponse.json({ success: true, action: 'booked', appointmentId: apt?.id })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

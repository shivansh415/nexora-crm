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
  phone: string
  title: string
  startTime: string   // ISO string or "YYYY-MM-DD HH:MM"
  endTime?: string
  location?: string
  notes?: string
  conversationId?: string
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-webhook-secret')
    if (authHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: AppointmentPayload = await request.json()
    const { phone, title, startTime, endTime, location, notes, conversationId } = body

    if (!phone || !title || !startTime) {
      return NextResponse.json({ error: 'Missing required fields: phone, title, startTime' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Find contact
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('phone_number', phone)
      .limit(1)

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'Contact not found for phone: ' + phone }, { status: 404 })
    }

    const contactId = contacts[0].id
    const start = new Date(startTime)
    const end = endTime ? new Date(endTime) : new Date(start.getTime() + 60 * 60 * 1000) // +1 hour default

    // Create appointment
    const { data: apt, error: aptErr } = await supabase
      .from('appointments')
      .insert({
        workspace_id: WORKSPACE_ID,
        contact_id: contactId,
        conversation_id: conversationId || null,
        title,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'scheduled',
        booked_by: 'ai',
        location: location || null,
        notes: notes || null,
      })
      .select('id')
      .single()

    if (aptErr) {
      return NextResponse.json({ error: 'Failed to create appointment', details: aptErr?.message }, { status: 500 })
    }

    // Update lead stage to qualified if they booked an appointment
    const { data: lead } = await supabase
      .from('leads')
      .select('id, stage')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('contact_id', contactId)
      .limit(1)
      .single()

    if (lead && lead.stage !== 'won') {
      await supabase
        .from('leads')
        .update({ stage: 'qualified', updated_at: new Date().toISOString() })
        .eq('id', lead.id)
    }

    // Update contact lead score to hot
    await supabase
      .from('contacts')
      .update({
        lead_score: 90,
        tags: ['WhatsApp', '🔥 Hot Lead', '📅 Appointment Booked'],
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    return NextResponse.json({ success: true, appointmentId: apt?.id })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone } from '@/lib/phone'

const WORKSPACE_ID = 'f38c0ad0-d4ef-4090-94eb-50d3f6a21bce'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// POST /api/contacts/create
// Body: { name?: string, phone: string, email?: string }
// Manually adds a contact to the CRM. Does NOT message them (WhatsApp's 24h rule).
export async function POST(req: NextRequest) {
  try {
    const { createClient: createServerClient } = await import('@/lib/supabase/server')
    const authSupabase = await createServerClient()
    const { data: { user } } = await authSupabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, phone: rawPhone, email } = await req.json() as { name?: string; phone: string; email?: string }

    const { value: phone, reason } = normalizePhone(rawPhone || '')
    if (!phone) {
      return NextResponse.json({ error: `Invalid phone number (${reason ?? 'unrecognized'})` }, { status: 400 })
    }

    const supabase = getSupabase()

    // Prevent duplicates
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('workspace_id', WORKSPACE_ID)
      .eq('phone_number', phone)
      .limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'A contact with this number already exists' }, { status: 409 })
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        workspace_id: WORKSPACE_ID,
        phone_number: phone,
        name: (name || '').trim() || phone,
        email: (email || '').trim() || null,
        source: 'manual',
        wa_id: phone,
        lead_score: 10,
        tags: ['Manual'],
        last_seen_at: new Date().toISOString(),
      })
      .select('id, name, phone_number, email, tags, lead_score, source, last_seen_at')
      .single()

    if (error || !contact) {
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, contact })
  } catch (err) {
    console.error('[contacts/create] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Receives WhatsApp delivery/read status callbacks and updates messages.status
// so the CRM shows the correct ticks (✓ sent, ✓✓ delivered, blue ✓✓ read).
//
// Point your Meta webhook (field: `messages`) or an n8n "status" branch at:
//   POST /api/webhook/status
//
// Accepts three payload shapes:
//   1. Raw Meta:   { entry: [{ changes: [{ value: { statuses: [{ id, status }] } }] }] }
//   2. n8n simple: { statuses: [{ id | wa_message_id, status }] }
//   3. Flat:       { wa_message_id | id, status }

const WEBHOOK_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-12) || 'crm-webhook-secret'

// Rank so status only moves forward (never downgrade read → delivered).
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3, failed: 2 }

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Meta uses GET for webhook verification (shared with the messages field).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(req: NextRequest) {
  try {
    // If a secret header is supplied (n8n), it must match. Raw Meta calls omit it.
    const secret = req.headers.get('x-webhook-secret')
    if (secret && secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const updates: { id: string; status: string }[] = []

    // Shape 1 — raw Meta webhook
    if (Array.isArray(body?.entry)) {
      for (const entry of body.entry) {
        for (const change of entry?.changes ?? []) {
          for (const s of change?.value?.statuses ?? []) {
            if (s?.id && s?.status) updates.push({ id: s.id, status: String(s.status) })
          }
        }
      }
    }
    // Shape 2 — { statuses: [...] }
    if (Array.isArray(body?.statuses)) {
      for (const s of body.statuses) {
        const id = s?.id ?? s?.wa_message_id
        if (id && s?.status) updates.push({ id, status: String(s.status) })
      }
    }
    // Shape 3 — flat
    const flatId = body?.wa_message_id ?? body?.id
    if (flatId && body?.status && !Array.isArray(body?.entry)) {
      updates.push({ id: flatId, status: String(body.status) })
    }

    if (updates.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 })
    }

    const supabase = getSupabase()
    let updated = 0

    for (const u of updates) {
      const status = u.status.toLowerCase()
      if (!(status in STATUS_RANK)) continue

      const { data: rows } = await supabase
        .from('messages')
        .select('id, status')
        .eq('wa_message_id', u.id)
        .limit(1)

      const row = rows?.[0]
      if (!row) continue

      const currentRank = STATUS_RANK[String(row.status).toLowerCase()] ?? 0
      // Never downgrade (except allow failed to always land).
      if (status !== 'failed' && STATUS_RANK[status] < currentRank) continue

      const { error } = await supabase
        .from('messages')
        .update({ status })
        .eq('id', row.id)
      if (!error) updated++
    }

    return NextResponse.json({ ok: true, updated })
  } catch (err) {
    console.error('[webhook/status] error:', err)
    // Return 200 so Meta/n8n don't enter a retry storm on malformed payloads.
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
